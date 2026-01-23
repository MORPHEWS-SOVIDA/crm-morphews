import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

interface NotificationPayload {
  type: 'order_created' | 'payment_confirmed' | 'payment_failed' | 'order_shipped' | 'order_delivered';
  sale_id: string;
  organization_id?: string;
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

    console.log(`Processing notification: ${type} for sale ${sale_id}`);

    // Fetch sale with lead info
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('id, total_cents, status, payment_status, organization_id, lead_id')
      .eq('id', sale_id)
      .single();

    if (saleError || !sale) {
      console.error("Sale not found:", saleError);
      return new Response(
        JSON.stringify({ error: "Sale not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch lead separately
    const { data: leadData } = await supabase
      .from('leads')
      .select('id, name, email, whatsapp')
      .eq('id', sale.lead_id)
      .single();

    const lead = leadData as { id: string; name: string; email: string; whatsapp: string } | null;

    // Fetch organization separately
    const { data: orgData } = await supabase
      .from('organizations')
      .select('name, email, whatsapp_notification_instance_id')
      .eq('id', sale.organization_id)
      .single();

    const org = orgData as { name: string; email: string; whatsapp_notification_instance_id?: string } | null;

    if (!lead) {
      console.log("No lead associated with sale");
      return new Response(
        JSON.stringify({ success: true, message: "No lead to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get notification templates
    const templates = getNotificationTemplates(type, {
      customerName: lead.name,
      orderId: sale_id.slice(0, 8).toUpperCase(),
      totalCents: sale.total_cents,
      storeName: org?.name || 'Loja',
    });

    const results = {
      email: false,
      whatsapp: false,
    };

    // Send Email
    if (lead.email && RESEND_API_KEY) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${org?.name || 'Loja'} <noreply@morphews.com.br>`,
            to: [lead.email],
            subject: templates.email.subject,
            html: templates.email.html,
          }),
        });

        if (emailRes.ok) {
          results.email = true;
          console.log(`Email sent to ${lead.email}`);
        } else {
          console.error("Email send failed:", await emailRes.text());
        }
      } catch (e) {
        console.error("Email error:", e);
      }
    }

    // Send WhatsApp
    if (lead.whatsapp && EVOLUTION_API_URL && EVOLUTION_API_KEY && org?.whatsapp_notification_instance_id) {
      try {
        // Get instance name
        const { data: instance } = await supabase
          .from('whatsapp_instances')
          .select('instance_name')
          .eq('id', org.whatsapp_notification_instance_id)
          .single();

        if (instance?.instance_name) {
          const whatsappRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance.instance_name}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              number: normalizePhone(lead.whatsapp),
              text: templates.whatsapp,
            }),
          });

          if (whatsappRes.ok) {
            results.whatsapp = true;
            console.log(`WhatsApp sent to ${lead.whatsapp}`);
          } else {
            console.error("WhatsApp send failed:", await whatsappRes.text());
          }
        }
      } catch (e) {
        console.error("WhatsApp error:", e);
      }
    }

    // Log notification (ignore errors if table doesn't exist)
    try {
      await supabase.from('notification_logs').insert({
        organization_id: sale.organization_id,
        lead_id: lead.id,
        sale_id: sale_id,
        notification_type: type,
        email_sent: results.email,
        whatsapp_sent: results.whatsapp,
      });
    } catch (e) {
      // Ignore - table may not exist
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Notification error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  return digits;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function getNotificationTemplates(
  type: string,
  data: { customerName: string; orderId: string; totalCents: number; storeName: string }
) {
  const { customerName, orderId, totalCents, storeName } = data;
  const total = formatCurrency(totalCents);
  const firstName = customerName.split(' ')[0];

  const templates: Record<string, { email: { subject: string; html: string }; whatsapp: string }> = {
    order_created: {
      email: {
        subject: `Pedido #${orderId} recebido - ${storeName}`,
        html: `
          <h1>Olá ${firstName}!</h1>
          <p>Recebemos seu pedido <strong>#${orderId}</strong> no valor de <strong>${total}</strong>.</p>
          <p>Estamos aguardando a confirmação do pagamento.</p>
          <p>Obrigado por comprar com a ${storeName}!</p>
        `,
      },
      whatsapp: `🛒 *Pedido Recebido!*\n\nOlá ${firstName}! Seu pedido *#${orderId}* no valor de *${total}* foi recebido.\n\nAguardando confirmação de pagamento.\n\n_${storeName}_`,
    },
    payment_confirmed: {
      email: {
        subject: `Pagamento confirmado - Pedido #${orderId}`,
        html: `
          <h1>Pagamento Confirmado! 🎉</h1>
          <p>Olá ${firstName}!</p>
          <p>Seu pagamento de <strong>${total}</strong> foi confirmado para o pedido <strong>#${orderId}</strong>.</p>
          <p>Estamos preparando seu pedido para envio.</p>
          <p>Obrigado por comprar com a ${storeName}!</p>
        `,
      },
      whatsapp: `✅ *Pagamento Confirmado!*\n\nOlá ${firstName}! O pagamento do seu pedido *#${orderId}* foi confirmado.\n\nValor: *${total}*\n\nEstamos preparando seu pedido!\n\n_${storeName}_`,
    },
    payment_failed: {
      email: {
        subject: `Problema no pagamento - Pedido #${orderId}`,
        html: `
          <h1>Problema no Pagamento</h1>
          <p>Olá ${firstName}!</p>
          <p>Infelizmente não conseguimos processar o pagamento do pedido <strong>#${orderId}</strong>.</p>
          <p>Por favor, tente novamente ou entre em contato conosco.</p>
          <p>Estamos à disposição!</p>
          <p><em>${storeName}</em></p>
        `,
      },
      whatsapp: `⚠️ *Problema no Pagamento*\n\nOlá ${firstName}! Não conseguimos processar o pagamento do pedido *#${orderId}*.\n\nPor favor, tente novamente ou entre em contato.\n\n_${storeName}_`,
    },
    order_shipped: {
      email: {
        subject: `Seu pedido #${orderId} foi enviado! 🚚`,
        html: `
          <h1>Pedido Enviado! 🚚</h1>
          <p>Olá ${firstName}!</p>
          <p>Seu pedido <strong>#${orderId}</strong> foi enviado e está a caminho!</p>
          <p>Em breve você receberá o código de rastreamento.</p>
          <p><em>${storeName}</em></p>
        `,
      },
      whatsapp: `🚚 *Pedido Enviado!*\n\nOlá ${firstName}! Seu pedido *#${orderId}* foi enviado e está a caminho!\n\n_${storeName}_`,
    },
    order_delivered: {
      email: {
        subject: `Pedido #${orderId} entregue! ✅`,
        html: `
          <h1>Pedido Entregue! ✅</h1>
          <p>Olá ${firstName}!</p>
          <p>Seu pedido <strong>#${orderId}</strong> foi entregue com sucesso!</p>
          <p>Esperamos que você aproveite sua compra.</p>
          <p>Obrigado por comprar com a ${storeName}!</p>
        `,
      },
      whatsapp: `✅ *Pedido Entregue!*\n\nOlá ${firstName}! Seu pedido *#${orderId}* foi entregue!\n\nEsperamos que aproveite sua compra 😊\n\n_${storeName}_`,
    },
  };

  return templates[type] || templates.order_created;
}
