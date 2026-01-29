/**
 * Partner Notifications Module
 * Sends email and WhatsApp notifications to partners when they earn commission from a sale
 * All notifications are logged to system_communication_logs for audit
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================================
// TYPES
// =====================================================

interface PartnerNotification {
  partnerType: 'affiliate' | 'coproducer' | 'industry' | 'factory';
  partnerName: string;
  partnerEmail?: string;
  partnerPhone?: string;
  commissionCents: number;
  customerName: string;
  saleId: string;
  productName?: string;
  organizationId?: string;
  organizationName?: string;
}

interface AdminWhatsAppConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
}

interface CommunicationLog {
  channel: 'whatsapp' | 'email';
  source: string;
  recipient_phone?: string;
  recipient_email?: string;
  recipient_name: string;
  organization_id?: string;
  organization_name?: string;
  sale_id?: string;
  subject?: string;
  message_content: string;
  status: 'sent' | 'failed';
  error_message?: string;
  metadata?: Record<string, unknown>;
}

// =====================================================
// HELPERS
// =====================================================

function normalizeWhatsApp(phone: string): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 10) return null;
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getPartnerTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    affiliate: 'Afiliado',
    coproducer: 'Co-produtor',
    industry: 'Indústria',
    factory: 'Fábrica',
  };
  return labels[type] || type;
}

// =====================================================
// LOGGING
// =====================================================

async function logCommunication(
  supabase: SupabaseClient,
  log: CommunicationLog
): Promise<void> {
  try {
    const { error } = await supabase
      .from('system_communication_logs')
      .insert({
        channel: log.channel,
        source: log.source,
        recipient_phone: log.recipient_phone,
        recipient_email: log.recipient_email,
        recipient_name: log.recipient_name,
        organization_id: log.organization_id,
        organization_name: log.organization_name,
        sale_id: log.sale_id,
        subject: log.subject,
        message_content: log.message_content,
        status: log.status,
        error_message: log.error_message,
        metadata: log.metadata || {},
      });

    if (error) {
      console.error('[PartnerNotifications] Failed to log communication:', error);
    }
  } catch (err) {
    console.error('[PartnerNotifications] Error logging communication:', err);
  }
}

// =====================================================
// WHATSAPP NOTIFICATION
// =====================================================

async function getAdminWhatsAppConfig(supabase: SupabaseClient): Promise<AdminWhatsAppConfig | null> {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "admin_whatsapp_instance")
      .maybeSingle();

    if (error || !data?.value) {
      console.log("[PartnerNotifications] No admin WhatsApp config found");
      return null;
    }

    const config = data.value as Record<string, string>;
    if (!config.api_url || !config.api_key || !config.instance_name) {
      console.log("[PartnerNotifications] Admin WhatsApp config incomplete");
      return null;
    }

    return {
      api_url: config.api_url,
      api_key: config.api_key,
      instance_name: config.instance_name,
    };
  } catch (err) {
    console.error("[PartnerNotifications] Error fetching admin WhatsApp config:", err);
    return null;
  }
}

async function sendWhatsAppNotification(
  supabase: SupabaseClient,
  config: AdminWhatsAppConfig,
  phone: string,
  message: string,
  notification: PartnerNotification
): Promise<boolean> {
  const normalizedPhone = normalizeWhatsApp(phone);
  if (!normalizedPhone) {
    console.log("[PartnerNotifications] Invalid phone number:", phone);
    return false;
  }

  let success = false;
  let errorMessage: string | undefined;

  try {
    const response = await fetch(
      `${config.api_url}/message/sendText/${config.instance_name}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": config.api_key,
        },
        body: JSON.stringify({
          number: normalizedPhone,
          text: message,
        }),
      }
    );

    if (response.ok) {
      console.log("[PartnerNotifications] WhatsApp sent to", normalizedPhone);
      success = true;
    } else {
      errorMessage = await response.text();
      console.error("[PartnerNotifications] WhatsApp error:", errorMessage);
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[PartnerNotifications] WhatsApp send error:", error);
  }

  // Log the communication
  await logCommunication(supabase, {
    channel: 'whatsapp',
    source: 'partner_notification',
    recipient_phone: normalizedPhone,
    recipient_name: notification.partnerName,
    organization_id: notification.organizationId,
    organization_name: notification.organizationName,
    sale_id: notification.saleId,
    message_content: message,
    status: success ? 'sent' : 'failed',
    error_message: errorMessage,
    metadata: {
      partner_type: notification.partnerType,
      commission_cents: notification.commissionCents,
      customer_name: notification.customerName,
    },
  });

  return success;
}

// =====================================================
// EMAIL NOTIFICATION
// =====================================================

async function sendEmailNotification(
  supabase: SupabaseClient,
  notification: PartnerNotification
): Promise<boolean> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.log("[PartnerNotifications] RESEND_API_KEY not configured");
    return false;
  }

  if (!notification.partnerEmail) {
    console.log("[PartnerNotifications] No email for partner:", notification.partnerName);
    return false;
  }

  let success = false;
  let errorMessage: string | undefined;
  const subject = `🎉 Nova venda! Você ganhou ${formatCurrency(notification.commissionCents)}`;

  try {
    const partnerTypeLabel = getPartnerTypeLabel(notification.partnerType);
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; }
          .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 20px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .header .emoji { font-size: 48px; margin-bottom: 10px; }
          .content { padding: 40px 30px; }
          .amount-box { background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0; }
          .amount-box .label { color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 5px; }
          .amount-box .value { color: white; font-size: 36px; font-weight: bold; }
          .details { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
          .details-row:last-child { border-bottom: none; }
          .details-label { color: #64748b; }
          .details-value { color: #1e293b; font-weight: 500; }
          .cta { text-align: center; margin: 30px 0; }
          .cta a { background: #6366f1; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; }
          .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="emoji">🎉</div>
            <h1>Parabéns, ${notification.partnerName}!</h1>
          </div>
          <div class="content">
            <p style="font-size: 18px; color: #334155; text-align: center;">
              Hora de comemorar! Você acabou de ganhar uma comissão!
            </p>
            
            <div class="amount-box">
              <div class="label">Sua comissão</div>
              <div class="value">${formatCurrency(notification.commissionCents)}</div>
            </div>
            
            <div class="details">
              <div class="details-row">
                <span class="details-label">Cliente</span>
                <span class="details-value">${notification.customerName}</span>
              </div>
              <div class="details-row">
                <span class="details-label">Seu papel</span>
                <span class="details-value">${partnerTypeLabel}</span>
              </div>
              ${notification.productName ? `
              <div class="details-row">
                <span class="details-label">Produto</span>
                <span class="details-value">${notification.productName}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="cta">
              <a href="https://crm.morphews.com/login">Acessar painel</a>
            </div>
            
            <p style="color: #64748b; text-align: center; font-size: 14px;">
              Acesse seu painel para ver detalhes completos e acompanhar seus ganhos.
            </p>
          </div>
          <div class="footer">
            <p>Este email foi enviado automaticamente pelo sistema Morphews.</p>
            <p>© ${new Date().getFullYear()} Morphews. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Morphews <vendas@morphews.com>",
        to: [notification.partnerEmail],
        subject,
        html: htmlContent,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log("[PartnerNotifications] Email sent to", notification.partnerEmail, result);
      success = true;
    } else {
      errorMessage = await response.text();
      console.error("[PartnerNotifications] Email error:", errorMessage);
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[PartnerNotifications] Email send error:", error);
  }

  // Log the communication
  await logCommunication(supabase, {
    channel: 'email',
    source: 'partner_notification',
    recipient_email: notification.partnerEmail,
    recipient_name: notification.partnerName,
    organization_id: notification.organizationId,
    organization_name: notification.organizationName,
    sale_id: notification.saleId,
    subject,
    message_content: `Comissão de ${formatCurrency(notification.commissionCents)} para ${notification.partnerName} (${getPartnerTypeLabel(notification.partnerType)})`,
    status: success ? 'sent' : 'failed',
    error_message: errorMessage,
    metadata: {
      partner_type: notification.partnerType,
      commission_cents: notification.commissionCents,
      customer_name: notification.customerName,
      product_name: notification.productName,
    },
  });

  return success;
}

// =====================================================
// MAIN NOTIFICATION FUNCTION
// =====================================================

export async function notifyPartnerOfSale(
  supabase: SupabaseClient,
  notification: PartnerNotification
): Promise<void> {
  console.log(`[PartnerNotifications] Notifying ${notification.partnerType}: ${notification.partnerName}`);

  const partnerTypeLabel = getPartnerTypeLabel(notification.partnerType);

  // WhatsApp notification
  if (notification.partnerPhone) {
    const whatsappConfig = await getAdminWhatsAppConfig(supabase);
    if (whatsappConfig) {
      const whatsappMessage = `🎉 *Parabéns, ${notification.partnerName}!*

Hora de comemorar! Saiu uma venda com seu link!

💰 *Sua comissão:* ${formatCurrency(notification.commissionCents)}
👤 *Cliente:* ${notification.customerName}
📦 *Tipo:* ${partnerTypeLabel}

Acesse crm.morphews.com/login e confira os detalhes! 🚀`;

      await sendWhatsAppNotification(supabase, whatsappConfig, notification.partnerPhone, whatsappMessage, notification);
    }
  }

  // Email notification
  if (notification.partnerEmail) {
    await sendEmailNotification(supabase, notification);
  }
}

// =====================================================
// BATCH NOTIFICATION FOR ALL PARTNERS IN A SALE
// =====================================================

interface PartnerInfo {
  type: 'affiliate' | 'coproducer' | 'industry' | 'factory';
  name: string;
  email?: string;
  phone?: string;
  commissionCents: number;
}

export async function notifyAllPartnersForSale(
  supabase: SupabaseClient,
  saleId: string,
  partners: PartnerInfo[]
): Promise<void> {
  if (partners.length === 0) {
    console.log("[PartnerNotifications] No partners to notify for sale", saleId);
    return;
  }

  // Get sale details for customer name and organization
  const { data: sale } = await supabase
    .from('sales')
    .select('lead_id, total_cents, organization_id')
    .eq('id', saleId)
    .single();

  let customerName = 'Cliente';
  let productName: string | undefined;
  let organizationId: string | undefined;
  let organizationName: string | undefined;

  if (sale?.organization_id) {
    organizationId = sale.organization_id;
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();
    organizationName = org?.name;
  }

  if (sale?.lead_id) {
    const { data: lead } = await supabase
      .from('leads')
      .select('name')
      .eq('id', sale.lead_id)
      .single();
    customerName = lead?.name || 'Cliente';
  }

  // Get first product name
  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('product_name')
    .eq('sale_id', saleId)
    .limit(1);

  if (saleItems && saleItems.length > 0) {
    productName = saleItems[0].product_name;
  }

  // Notify each partner
  for (const partner of partners) {
    await notifyPartnerOfSale(supabase, {
      partnerType: partner.type,
      partnerName: partner.name,
      partnerEmail: partner.email,
      partnerPhone: partner.phone,
      commissionCents: partner.commissionCents,
      customerName,
      saleId,
      productName,
      organizationId,
      organizationName,
    });
  }

  console.log(`[PartnerNotifications] Notified ${partners.length} partners for sale ${saleId}`);
}
