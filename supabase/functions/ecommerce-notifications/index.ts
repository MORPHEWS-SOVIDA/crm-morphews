import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  product_image_url?: string;
}

interface NotificationPayload {
  type: 'order_created' | 'payment_confirmed' | 'payment_failed' | 'order_shipped' | 'order_delivered' | 'pix_pending' | 'boleto_pending' | 'sale_notification_owner';
  sale_id: string;
  organization_id?: string;
  // Extra data for PIX/boleto
  pix_code?: string;
  pix_expiration?: string;
  boleto_barcode?: string;
  boleto_url?: string;
  boleto_expiration?: string;
  // Order items for rich emails
  items?: OrderItem[];
  subtotal_cents?: number;
  shipping_cents?: number;
  total_cents?: number;
  payment_method?: string;
  order_number?: string;
  customer_name?: string;
  customer_email?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();
    const { type, sale_id } = payload;

    console.log(`[EcomNotif] Processing: ${type} for sale ${sale_id}`);

    // Fetch sale with items
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('id, total_cents, subtotal_cents, shipping_cost_cents, status, payment_status, payment_method, organization_id, lead_id')
      .eq('id', sale_id)
      .single();

    if (saleError || !sale) {
      console.error("[EcomNotif] Sale not found:", saleError);
      return new Response(
        JSON.stringify({ error: "Sale not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch lead
    const { data: leadData } = await supabase
      .from('leads')
      .select('id, name, email, whatsapp')
      .eq('id', sale.lead_id)
      .single();

    const lead = leadData as { id: string; name: string; email: string; whatsapp: string } | null;

    // Fetch organization
    const { data: orgData } = await supabase
      .from('organizations')
      .select('name, email')
      .eq('id', sale.organization_id)
      .single();

    const org = orgData as { name: string; email: string } | null;

    // === OWNER NOTIFICATION: different flow ===
    if (type === 'sale_notification_owner') {
      return await handleOwnerNotification(supabase, sale, lead, org, payload, sale_id);
    }

    // Use email from payload, lead, or skip
    const recipientEmail = payload.customer_email || lead?.email;
    const customerName = payload.customer_name || lead?.name || 'Cliente';

    if (!recipientEmail) {
      console.log("[EcomNotif] No email for customer, skipping");
      return new Response(
        JSON.stringify({ success: true, message: "No email to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch sale items if not provided
    let items: OrderItem[] = payload.items || [];
    if (items.length === 0) {
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('product_name, quantity, unit_price_cents, total_cents')
        .eq('sale_id', sale_id);
      
      if (saleItems) {
        items = saleItems.map(si => ({
          product_name: si.product_name,
          quantity: si.quantity,
          unit_price_cents: si.unit_price_cents,
          total_cents: si.total_cents,
        }));
      }
    }

    // Get order number
    let orderNumber = payload.order_number || '';
    if (!orderNumber) {
      const { data: orderData } = await supabase
        .from('ecommerce_orders')
        .select('order_number')
        .eq('sale_id', sale_id)
        .maybeSingle();
      orderNumber = orderData?.order_number || sale_id.slice(0, 8).toUpperCase();
    }

    const totalCents = payload.total_cents || sale.total_cents || 0;
    const subtotalCents = payload.subtotal_cents || sale.subtotal_cents || totalCents;
    const shippingCents = payload.shipping_cents || sale.shipping_cost_cents || 0;
    const storeName = org?.name || 'Loja';
    const firstName = customerName.split(' ')[0];

    // Build and send email
    const emailHtml = buildEmailHtml(type, {
      firstName,
      customerName,
      orderNumber,
      items,
      subtotalCents,
      shippingCents,
      totalCents,
      storeName,
      pixCode: payload.pix_code,
      pixExpiration: payload.pix_expiration,
      boletoBarcode: payload.boleto_barcode,
      boletoUrl: payload.boleto_url,
      boletoExpiration: payload.boleto_expiration,
      paymentMethod: payload.payment_method || sale.payment_method || '',
    });

    const emailSubject = getEmailSubject(type, orderNumber, storeName);

    let emailSent = false;
    if (RESEND_API_KEY) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${storeName} <noreply@updates.atomic.ia.br>`,
            to: [recipientEmail],
            subject: emailSubject,
            html: emailHtml,
          }),
        });

        if (emailRes.ok) {
          emailSent = true;
          console.log(`[EcomNotif] Email sent to ${recipientEmail} (${type})`);
        } else {
          const errText = await emailRes.text();
          console.error("[EcomNotif] Email send failed:", errText);
        }
      } catch (e) {
        console.error("[EcomNotif] Email error:", e);
      }
    } else {
      console.warn("[EcomNotif] No RESEND_API_KEY configured, skipping email");
    }

    return new Response(
      JSON.stringify({ success: true, email_sent: emailSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[EcomNotif] Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =====================================================
// EMAIL SUBJECT
// =====================================================

function getEmailSubject(type: string, orderNumber: string, storeName: string): string {
  switch (type) {
    case 'pix_pending':
      return `PIX para pagamento - Pedido #${orderNumber} - ${storeName}`;
    case 'boleto_pending':
      return `Boleto para pagamento - Pedido #${orderNumber} - ${storeName}`;
    case 'payment_confirmed':
      return `✅ Pagamento confirmado! Pedido #${orderNumber} - ${storeName}`;
    case 'order_created':
      return `Pedido #${orderNumber} recebido - ${storeName}`;
    case 'payment_failed':
      return `⚠️ Problema no pagamento - Pedido #${orderNumber}`;
    case 'order_shipped':
      return `🚚 Pedido #${orderNumber} enviado! - ${storeName}`;
    case 'order_delivered':
      return `✅ Pedido #${orderNumber} entregue! - ${storeName}`;
    case 'sale_notification_owner':
      return `🎉 Parabéns! Nova venda - Pedido #${orderNumber} - ${storeName}`;
    default:
      return `Pedido #${orderNumber} - ${storeName}`;
  }
}

// =====================================================
// EMAIL HTML BUILDER
// =====================================================

interface EmailData {
  firstName: string;
  customerName: string;
  orderNumber: string;
  items: OrderItem[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  storeName: string;
  pixCode?: string;
  pixExpiration?: string;
  boletoBarcode?: string;
  boletoUrl?: string;
  boletoExpiration?: string;
  paymentMethod: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function buildItemsTable(items: OrderItem[]): string {
  if (items.length === 0) return '';
  
  const rows = items.map(item => `
    <tr>
      <td style="padding: 12px 8px; border-bottom: 1px solid #eee; font-size: 14px; color: #333;">
        ${item.product_name}
      </td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #eee; font-size: 14px; color: #555; text-align: center;">
        ${item.quantity}
      </td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; text-align: right;">
        ${formatCurrency(item.total_cents)}
      </td>
    </tr>
  `).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <thead>
        <tr style="background-color: #f8f9fa;">
          <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Produto</th>
          <th style="padding: 10px 8px; text-align: center; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Qtd</th>
          <th style="padding: 10px 8px; text-align: right; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function buildTotalsSection(data: EmailData): string {
  let html = '<div style="margin: 20px 0; padding: 16px; background-color: #f8f9fa; border-radius: 8px;">';
  
  if (data.subtotalCents !== data.totalCents) {
    html += `<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span style="font-size: 14px; color: #555;">Subtotal:</span>
      <span style="font-size: 14px; color: #333;">${formatCurrency(data.subtotalCents)}</span>
    </div>`;
  }
  
  if (data.shippingCents > 0) {
    html += `<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span style="font-size: 14px; color: #555;">Frete:</span>
      <span style="font-size: 14px; color: #333;">${formatCurrency(data.shippingCents)}</span>
    </div>`;
  }
  
  html += `<div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 2px solid #ddd;">
    <span style="font-size: 16px; font-weight: bold; color: #111;">Total:</span>
    <span style="font-size: 16px; font-weight: bold; color: #111;">${formatCurrency(data.totalCents)}</span>
  </div>`;
  
  html += '</div>';
  return html;
}

function buildEmailHtml(type: string, data: EmailData): string {
  let bodyContent = '';
  
  switch (type) {
    case 'pix_pending':
      bodyContent = buildPixPendingBody(data);
      break;
    case 'boleto_pending':
      bodyContent = buildBoletoPendingBody(data);
      break;
    case 'payment_confirmed':
      bodyContent = buildPaymentConfirmedBody(data);
      break;
    case 'order_created':
      bodyContent = buildOrderCreatedBody(data);
      break;
    case 'payment_failed':
      bodyContent = buildPaymentFailedBody(data);
      break;
    case 'order_shipped':
      bodyContent = buildOrderShippedBody(data);
      break;
    case 'order_delivered':
      bodyContent = buildOrderDeliveredBody(data);
      break;
    default:
      bodyContent = buildOrderCreatedBody(data);
  }

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
              <!-- Header -->
              <tr>
                <td style="background-color: #111827; padding: 30px 40px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">
                    ${data.storeName}
                  </h1>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 40px;">
                  ${bodyContent}
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 24px 40px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #999;">
                    Este e-mail foi enviado automaticamente pela ${data.storeName}.<br>
                    Em caso de dúvidas, entre em contato conosco.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// =====================================================
// EMAIL BODY BUILDERS
// =====================================================

function buildPixPendingBody(data: EmailData): string {
  const pixSection = data.pixCode ? `
    <div style="margin: 24px 0; padding: 24px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; border: 2px solid #10b981;">
      <h3 style="margin: 0 0 8px 0; color: #065f46; font-size: 16px;">🟢 Código PIX (Copia e Cola)</h3>
      <p style="margin: 0 0 12px 0; font-size: 13px; color: #047857;">Copie o código abaixo e cole no app do seu banco:</p>
      <div style="background: #ffffff; border: 1px dashed #10b981; border-radius: 8px; padding: 16px; word-break: break-all; font-family: monospace; font-size: 12px; color: #333; line-height: 1.5;">
        ${data.pixCode}
      </div>
      ${data.pixExpiration ? `<p style="margin: 12px 0 0 0; font-size: 12px; color: #6b7280;">⏰ Este código expira em: ${data.pixExpiration}</p>` : ''}
    </div>
  ` : '';

  return `
    <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #111;">Olá ${data.firstName}! 👋</h2>
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #555;">Seu pedido <strong>#${data.orderNumber}</strong> foi recebido. Use o código PIX abaixo para realizar o pagamento:</p>
    
    ${pixSection}
    
    <h3 style="margin: 24px 0 0 0; font-size: 16px; color: #333;">📋 Resumo do Pedido</h3>
    ${buildItemsTable(data.items)}
    ${buildTotalsSection(data)}
    
    <p style="margin: 20px 0 0 0; font-size: 14px; color: #666;">
      Assim que identificarmos o pagamento, enviaremos um e-mail de confirmação.
    </p>
  `;
}

function buildBoletoPendingBody(data: EmailData): string {
  const boletoSection = `
    <div style="margin: 24px 0; padding: 24px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; border: 2px solid #3b82f6;">
      <h3 style="margin: 0 0 8px 0; color: #1e40af; font-size: 16px;">📄 Dados do Boleto</h3>
      ${data.boletoBarcode ? `
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #1e40af;">Linha digitável:</p>
        <div style="background: #ffffff; border: 1px dashed #3b82f6; border-radius: 8px; padding: 16px; word-break: break-all; font-family: monospace; font-size: 13px; color: #333; letter-spacing: 1px;">
          ${data.boletoBarcode}
        </div>
      ` : ''}
      ${data.boletoUrl ? `
        <div style="margin-top: 16px; text-align: center;">
          <a href="${data.boletoUrl}" target="_blank" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            📥 Abrir Boleto
          </a>
        </div>
      ` : ''}
      ${data.boletoExpiration ? `<p style="margin: 12px 0 0 0; font-size: 12px; color: #6b7280;">⏰ Vencimento: ${data.boletoExpiration}</p>` : ''}
    </div>
  `;

  return `
    <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #111;">Olá ${data.firstName}! 👋</h2>
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #555;">Seu pedido <strong>#${data.orderNumber}</strong> foi recebido. Segue o boleto para pagamento:</p>
    
    ${boletoSection}
    
    <h3 style="margin: 24px 0 0 0; font-size: 16px; color: #333;">📋 Resumo do Pedido</h3>
    ${buildItemsTable(data.items)}
    ${buildTotalsSection(data)}
    
    <p style="margin: 20px 0 0 0; font-size: 14px; color: #666;">
      O pagamento pode levar até 2 dias úteis para ser compensado. Assim que identificarmos, enviaremos um e-mail de confirmação.
    </p>
  `;
}

function buildPaymentConfirmedBody(data: EmailData): string {
  const paymentLabel = data.paymentMethod === 'pix' ? 'PIX' : data.paymentMethod === 'credit_card' ? 'Cartão de Crédito' : data.paymentMethod === 'boleto' ? 'Boleto' : 'Pagamento';
  
  return `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; width: 64px; height: 64px; line-height: 64px; font-size: 32px;">
        ✅
      </div>
    </div>
    
    <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #111; text-align: center;">Pagamento Confirmado! 🎉</h2>
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #555; text-align: center;">
      Olá <strong>${data.firstName}</strong>, seu pagamento via <strong>${paymentLabel}</strong> foi confirmado com sucesso!
    </p>
    
    <div style="margin: 20px 0; padding: 16px; background-color: #ecfdf5; border-radius: 8px; border-left: 4px solid #10b981;">
      <p style="margin: 0; font-size: 14px; color: #065f46;">
        <strong>Pedido #${data.orderNumber}</strong> — Estamos preparando seu pedido!
      </p>
    </div>
    
    <h3 style="margin: 24px 0 0 0; font-size: 16px; color: #333;">📦 Itens do Pedido</h3>
    ${buildItemsTable(data.items)}
    ${buildTotalsSection(data)}
    
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #666; text-align: center;">
      Obrigado por comprar com a <strong>${data.storeName}</strong>! 💚<br>
      Você receberá atualizações sobre o envio por e-mail.
    </p>
  `;
}

function buildOrderCreatedBody(data: EmailData): string {
  return `
    <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #111;">Olá ${data.firstName}! 👋</h2>
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #555;">Recebemos seu pedido <strong>#${data.orderNumber}</strong>.</p>
    
    <h3 style="margin: 24px 0 0 0; font-size: 16px; color: #333;">📋 Resumo do Pedido</h3>
    ${buildItemsTable(data.items)}
    ${buildTotalsSection(data)}
    
    <p style="margin: 20px 0 0 0; font-size: 14px; color: #666;">
      Estamos aguardando a confirmação do pagamento. Obrigado por comprar com a ${data.storeName}!
    </p>
  `;
}

function buildPaymentFailedBody(data: EmailData): string {
  return `
    <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #111;">Olá ${data.firstName},</h2>
    <div style="margin: 20px 0; padding: 16px; background-color: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
      <p style="margin: 0; font-size: 14px; color: #991b1b;">
        Infelizmente não conseguimos processar o pagamento do pedido <strong>#${data.orderNumber}</strong>.
      </p>
    </div>
    <p style="font-size: 14px; color: #555;">
      Por favor, tente novamente ou entre em contato conosco para ajudarmos.
    </p>
    <p style="font-size: 14px; color: #666;"><em>${data.storeName}</em></p>
  `;
}

function buildOrderShippedBody(data: EmailData): string {
  return `
    <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #111;">Pedido Enviado! 🚚</h2>
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #555;">
      Olá <strong>${data.firstName}</strong>, seu pedido <strong>#${data.orderNumber}</strong> foi enviado e está a caminho!
    </p>
    ${buildItemsTable(data.items)}
    <p style="font-size: 14px; color: #666;">
      Em breve você receberá o código de rastreamento.<br>
      <em>${data.storeName}</em>
    </p>
  `;
}

function buildOrderDeliveredBody(data: EmailData): string {
  return `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 48px;">📦✅</div>
    </div>
    <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #111; text-align: center;">Pedido Entregue!</h2>
    <p style="margin: 0 0 20px 0; font-size: 16px; color: #555; text-align: center;">
      Olá <strong>${data.firstName}</strong>, seu pedido <strong>#${data.orderNumber}</strong> foi entregue com sucesso!
    </p>
    ${buildItemsTable(data.items)}
    <p style="font-size: 14px; color: #666; text-align: center;">
      Esperamos que aproveite sua compra! 😊<br>
      Obrigado por comprar com a <strong>${data.storeName}</strong>!
    </p>
  `;
}

// =====================================================
// OWNER NOTIFICATION HANDLER
// =====================================================

async function handleOwnerNotification(
  supabase: any,
  sale: any,
  lead: any,
  org: any,
  payload: NotificationPayload,
  sale_id: string
): Promise<Response> {
  const storeName = org?.name || 'Loja';
  const customerName = lead?.name || 'Cliente';
  const customerEmail = lead?.email || '';
  const customerPhone = lead?.whatsapp || '';

  // Find org owner email(s) from organization_members
  const { data: members } = await supabase
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', sale.organization_id)
    .eq('role', 'owner');

  const ownerEmails: string[] = [];
  if (members && members.length > 0) {
    for (const member of members) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, first_name')
        .eq('user_id', member.user_id)
        .single();
      if (profile?.email) ownerEmails.push(profile.email);
    }
  }

  // Fallback to org email
  if (ownerEmails.length === 0 && org?.email) {
    ownerEmails.push(org.email);
  }

  if (ownerEmails.length === 0) {
    console.log("[EcomNotif] No owner email found for org", sale.organization_id);
    return new Response(
      JSON.stringify({ success: true, message: "No owner email" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fetch sale items
  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('product_name, quantity, unit_price_cents, total_cents')
    .eq('sale_id', sale_id);

  const items: OrderItem[] = (saleItems || []).map((si: any) => ({
    product_name: si.product_name,
    quantity: si.quantity,
    unit_price_cents: si.unit_price_cents,
    total_cents: si.total_cents,
  }));

  // Get order number
  const { data: orderData } = await supabase
    .from('ecommerce_orders')
    .select('order_number, shipping_address')
    .eq('sale_id', sale_id)
    .maybeSingle();

  const orderNumber = orderData?.order_number || sale_id.slice(0, 8).toUpperCase();
  const shippingAddress = orderData?.shipping_address as Record<string, string> | null;

  const totalCents = sale.total_cents || 0;
  const subtotalCents = sale.subtotal_cents || totalCents;
  const shippingCents = sale.shipping_cost_cents || 0;
  const paymentMethod = payload.payment_method || sale.payment_method || '';
  const paymentLabel = paymentMethod === 'pix' ? 'Pix' : paymentMethod === 'credit_card' ? 'Cartão de Crédito' : paymentMethod === 'boleto' ? 'Boleto' : paymentMethod;

  // Build address section
  let addressHtml = '';
  if (shippingAddress) {
    const parts = [
      shippingAddress.street,
      shippingAddress.number ? `, ${shippingAddress.number}` : '',
      shippingAddress.complement ? ` - ${shippingAddress.complement}` : '',
    ].join('');
    addressHtml = `
      <div style="margin: 20px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">📍 Endereço de Entrega</h3>
        ${shippingAddress.document ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;"><strong>CPF:</strong> ${shippingAddress.document}</p>` : ''}
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;">${parts}</p>
        ${shippingAddress.neighborhood ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #333;">${shippingAddress.neighborhood}</p>` : ''}
        <p style="margin: 0; font-size: 14px; color: #333;">${shippingAddress.city || ''} - ${shippingAddress.state || ''} ${shippingAddress.zip ? `CEP ${shippingAddress.zip}` : ''}</p>
      </div>
    `;
  }

  const ownerEmailHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 40px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 8px;">🎉</div>
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Você tem uma nova venda \\o/</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">Pedido nº ${orderNumber}</p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding: 40px;">
                <!-- Cliente -->
                <div style="margin-bottom: 24px;">
                  <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">👤 Cliente</h3>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 6px 0; font-size: 14px; color: #666; width: 80px;">Nome</td>
                      <td style="padding: 6px 0; font-size: 14px; color: #111; font-weight: 500;">${customerName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-size: 14px; color: #666;">E-mail</td>
                      <td style="padding: 6px 0; font-size: 14px; color: #111;">${customerEmail}</td>
                    </tr>
                    ${customerPhone ? `
                    <tr>
                      <td style="padding: 6px 0; font-size: 14px; color: #666;">Celular</td>
                      <td style="padding: 6px 0; font-size: 14px; color: #111;">${customerPhone}</td>
                    </tr>
                    ` : ''}
                  </table>
                </div>

                <!-- Endereço -->
                ${addressHtml}

                <!-- Pedido -->
                <div style="margin-top: 24px;">
                  <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">📦 Pedido</h3>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <thead>
                      <tr style="background-color: #f8f9fa;">
                        <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #666; text-transform: uppercase;">Produto</th>
                        <th style="padding: 10px 8px; text-align: center; font-size: 12px; color: #666; text-transform: uppercase;">Qtd</th>
                        <th style="padding: 10px 8px; text-align: right; font-size: 12px; color: #666; text-transform: uppercase;">Preço</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${items.map(item => `
                      <tr>
                        <td style="padding: 12px 8px; border-bottom: 1px solid #eee; font-size: 14px; color: #333;">${item.product_name}</td>
                        <td style="padding: 12px 8px; border-bottom: 1px solid #eee; font-size: 14px; color: #555; text-align: center;">${item.quantity}</td>
                        <td style="padding: 12px 8px; border-bottom: 1px solid #eee; font-size: 14px; color: #333; text-align: right;">${formatCurrency(item.total_cents)}</td>
                      </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>

                <!-- Totais -->
                <div style="margin: 20px 0; padding: 16px; background-color: #f8f9fa; border-radius: 8px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 6px 8px; font-size: 14px; color: #555;">Pagamento:</td>
                      <td style="padding: 6px 8px; font-size: 14px; color: #333; text-align: right;">${paymentLabel}</td>
                    </tr>
                    ${shippingCents > 0 ? `
                    <tr>
                      <td style="padding: 6px 8px; font-size: 14px; color: #555;">Frete:</td>
                      <td style="padding: 6px 8px; font-size: 14px; color: #333; text-align: right;">${formatCurrency(shippingCents)}</td>
                    </tr>
                    ` : `
                    <tr>
                      <td style="padding: 6px 8px; font-size: 14px; color: #555;">Frete:</td>
                      <td style="padding: 6px 8px; font-size: 14px; color: #10b981; text-align: right;">Grátis</td>
                    </tr>
                    `}
                    ${subtotalCents !== totalCents ? `
                    <tr>
                      <td style="padding: 6px 8px; font-size: 14px; color: #555;">Subtotal:</td>
                      <td style="padding: 6px 8px; font-size: 14px; color: #333; text-align: right;">${formatCurrency(subtotalCents)}</td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding: 8px; font-size: 18px; font-weight: bold; color: #111; border-top: 2px solid #ddd;">Total:</td>
                      <td style="padding: 8px; font-size: 18px; font-weight: bold; color: #111; text-align: right; border-top: 2px solid #ddd;">${formatCurrency(totalCents)}</td>
                    </tr>
                  </table>
                </div>

                <!-- CTA -->
                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://atomic.ia.br/vendas" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                    Ver detalhes do pedido
                  </a>
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color: #f8f9fa; padding: 24px 40px; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #999;">
                  Este e-mail foi enviado automaticamente pela ${storeName}.<br>
                  © ${new Date().getFullYear()} Atomic Sales. Todos os direitos reservados.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  const subject = `🎉 Parabéns! Nova venda - Pedido #${orderNumber} - ${storeName}`;

  let emailSent = false;
  if (RESEND_API_KEY) {
    try {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${storeName} <vendas@updates.atomic.ia.br>`,
          to: ownerEmails,
          subject,
          html: ownerEmailHtml,
        }),
      });

      if (emailRes.ok) {
        emailSent = true;
        console.log(`[EcomNotif] Owner notification sent to ${ownerEmails.join(', ')} for sale ${sale_id}`);
      } else {
        const errText = await emailRes.text();
        console.error("[EcomNotif] Owner email send failed:", errText);
      }
    } catch (e) {
      console.error("[EcomNotif] Owner email error:", e);
    }
  }

  return new Response(
    JSON.stringify({ success: true, email_sent: emailSent, recipients: ownerEmails }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
