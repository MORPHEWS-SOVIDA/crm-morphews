import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

interface ChargebackPayload {
  sale_id: string;
  organization_id: string;
  amount_cents: number;
  reason?: string;
}

interface PartnerInfo {
  type: string;
  name: string;
  email?: string;
  whatsapp?: string;
  amount_debited: number;
  new_balance: number;
}

/**
 * Chargeback Alerts Edge Function
 * 
 * Sends notifications to ALL parties involved when a chargeback occurs:
 * - Tenant (store owner)
 * - Affiliates
 * - Coproducers
 * - Industries
 * - Factories
 * - Platform Super Admin
 * 
 * Also creates SAC ticket for tracking
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: ChargebackPayload = await req.json();
    const { sale_id, organization_id, amount_cents, reason } = payload;

    console.log(`[ChargebackAlerts] Processing alerts for sale ${sale_id}`);

    // 1. Fetch sale details
    const { data: sale } = await supabase
      .from('sales')
      .select(`
        id, 
        total_cents,
        lead_id,
        organization_id,
        created_at,
        gateway_transaction_id
      `)
      .eq('id', sale_id)
      .single();

    if (!sale) {
      throw new Error('Venda não encontrada');
    }

    // 2. Fetch organization
    const { data: org } = await supabase
      .from('organizations')
      .select('name, email, whatsapp_notification_instance_id')
      .eq('id', organization_id)
      .single();

    // 3. Fetch lead (customer who did chargeback)
    const { data: lead } = await supabase
      .from('leads')
      .select('name, email, whatsapp, cpf')
      .eq('id', sale.lead_id)
      .maybeSingle();

    // 4. Fetch all affected splits with partner info
    const { data: affectedSplits } = await supabase
      .from('sale_splits')
      .select(`
        split_type,
        net_amount_cents,
        gross_amount_cents,
        virtual_account:virtual_accounts(
          id,
          holder_name,
          holder_email,
          holder_phone,
          balance_cents,
          pending_balance_cents
        )
      `)
      .eq('sale_id', sale_id)
      .eq('liable_for_chargeback', true);

    // 5. Build list of affected partners
    const affectedPartners: PartnerInfo[] = [];
    
    if (affectedSplits) {
      for (const split of affectedSplits) {
        const account = split.virtual_account as unknown as Record<string, unknown> | null;
        if (!account) continue;

        const amountDebited = split.net_amount_cents || split.gross_amount_cents || 0;
        const currentBalance = ((account.balance_cents as number) || 0) + ((account.pending_balance_cents as number) || 0);
        
        affectedPartners.push({
          type: translateSplitType(split.split_type),
          name: (account.holder_name as string) || 'Parceiro',
          email: account.holder_email as string | undefined,
          whatsapp: account.holder_phone as string | undefined,
          amount_debited: amountDebited,
          new_balance: currentBalance,
        });
      }
    }

    const results = {
      partners_notified: 0,
      admin_notified: false,
      sac_ticket_created: false,
    };

    const orderIdShort = sale_id.slice(0, 8).toUpperCase();
    const chargebackAmount = formatCurrency(amount_cents);
    const customerName = lead?.name || 'Cliente';
    const storeName = org?.name || 'Loja';

    // 6. Notify each affected partner
    for (const partner of affectedPartners) {
      const debitedAmount = formatCurrency(partner.amount_debited);
      const balanceAfter = formatCurrency(partner.new_balance);
      const isNegative = partner.new_balance < 0;

      // Email notification
      if (partner.email && RESEND_API_KEY) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
               from: `Atomic Sales <alertas@atomic.ia.br>`,
              to: [partner.email],
              subject: `⚠️ CHARGEBACK - Débito de ${debitedAmount} em sua conta`,
              html: getPartnerEmailTemplate({
                partnerName: partner.name,
                partnerType: partner.type,
                orderId: orderIdShort,
                customerName,
                chargebackAmount,
                debitedAmount,
                balanceAfter,
                isNegative,
                storeName,
                reason: reason || 'Não informado',
              }),
            }),
          });
          console.log(`[ChargebackAlerts] Email sent to ${partner.type}: ${partner.email}`);
          results.partners_notified++;
        } catch (e) {
          console.error(`[ChargebackAlerts] Email error for ${partner.type}:`, e);
        }
      }

      // WhatsApp notification
      if (partner.whatsapp && EVOLUTION_API_URL && EVOLUTION_API_KEY && org?.whatsapp_notification_instance_id) {
        try {
          const { data: instance } = await supabase
            .from('whatsapp_instances')
            .select('instance_name')
            .eq('id', org.whatsapp_notification_instance_id)
            .single();

          if (instance?.instance_name) {
            const whatsappMessage = getPartnerWhatsAppMessage({
              partnerName: partner.name,
              partnerType: partner.type,
              orderId: orderIdShort,
              debitedAmount,
              balanceAfter,
              isNegative,
            });

            await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance.instance_name}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: EVOLUTION_API_KEY,
              },
              body: JSON.stringify({
                number: normalizePhone(partner.whatsapp),
                text: whatsappMessage,
              }),
            });
            console.log(`[ChargebackAlerts] WhatsApp sent to ${partner.type}: ${partner.whatsapp}`);
          }
        } catch (e) {
          console.error(`[ChargebackAlerts] WhatsApp error for ${partner.type}:`, e);
        }
      }
    }

    // 7. Notify Tenant (store owner)
    if (org?.email && RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `Atomic Sales <alertas@atomic.ia.br>`,
            to: [org.email],
            subject: `🚨 CHARGEBACK RECEBIDO - Pedido #${orderIdShort}`,
            html: getTenantEmailTemplate({
              storeName,
              orderId: orderIdShort,
              customerName,
              customerCpf: lead?.cpf || 'N/A',
              chargebackAmount,
              affectedPartners,
              reason: reason || 'Não informado',
              saleDate: new Date(sale.created_at).toLocaleDateString('pt-BR'),
            }),
          }),
        });
        console.log(`[ChargebackAlerts] Tenant email sent to ${org.email}`);
      } catch (e) {
        console.error(`[ChargebackAlerts] Tenant email error:`, e);
      }
    }

    // 8. Notify Super Admins (platform managers)
    const { data: superAdmins } = await supabase
      .from('profiles')
      .select('user_id, full_name, email:user_id')
      .eq('role', 'super_admin');

    // Get admin emails from auth
    if (superAdmins && superAdmins.length > 0) {
      for (const admin of superAdmins) {
        const { data: authUser } = await supabase.auth.admin.getUserById(admin.user_id);
        if (authUser?.user?.email && RESEND_API_KEY) {
          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: `Atomic Sales Sistema <sistema@atomic.ia.br>`,
                to: [authUser.user.email],
                subject: `🚨 [GATEWAY] CHARGEBACK - ${storeName} - ${chargebackAmount}`,
                html: getAdminEmailTemplate({
                  storeName,
                  organizationId: organization_id,
                  orderId: orderIdShort,
                  saleId: sale_id,
                  customerName,
                  customerCpf: lead?.cpf || 'N/A',
                  chargebackAmount,
                  affectedPartners,
                  gatewayTransactionId: sale.gateway_transaction_id,
                  reason: reason || 'Não informado',
                }),
              }),
            });
            console.log(`[ChargebackAlerts] Admin email sent to ${authUser.user.email}`);
            results.admin_notified = true;
          } catch (e) {
            console.error(`[ChargebackAlerts] Admin email error:`, e);
          }
        }
      }
    }

    // 9. Create SAC Ticket for tracking
    try {
      await supabase
        .from('sac_tickets')
        .insert({
          organization_id,
          lead_id: sale.lead_id,
          sale_id,
          category: 'Financeiro',
          subcategory: 'Chargeback',
          priority: 'high',
          status: 'open',
          title: `CHARGEBACK - Pedido #${orderIdShort} - ${chargebackAmount}`,
          description: `
**Chargeback Automático Detectado**

- **Pedido:** #${orderIdShort}
- **Cliente:** ${customerName}
- **CPF:** ${lead?.cpf || 'N/A'}
- **Valor:** ${chargebackAmount}
- **Motivo Gateway:** ${reason || 'Não informado'}

**Parceiros Afetados:**
${affectedPartners.map(p => `- ${p.type}: ${p.name} → Debitado ${formatCurrency(p.amount_debited)}${p.new_balance < 0 ? ' ⚠️ SALDO NEGATIVO' : ''}`).join('\n')}

**Ação Requerida:**
1. Verificar se há evidências de fraude
2. Contatar cliente se necessário
3. Avaliar contestação junto ao gateway
4. Monitorar saldos negativos de parceiros
          `.trim(),
          source: 'system',
        });
      results.sac_ticket_created = true;
      console.log(`[ChargebackAlerts] SAC ticket created`);
    } catch (e) {
      console.error(`[ChargebackAlerts] SAC ticket error:`, e);
    }

    // 10. Log to communication logs for audit
    try {
      await supabase.from('system_communication_logs').insert({
        organization_id,
        recipient_type: 'mixed',
        recipient_identifier: `chargeback:${sale_id}`,
        channel: 'email',
        source: 'chargeback-alerts',
        subject: `Chargeback Alert - ${orderIdShort}`,
        content: JSON.stringify({
          sale_id,
          amount_cents,
          partners_notified: results.partners_notified,
          admin_notified: results.admin_notified,
        }),
        status: 'sent',
        metadata: { affected_partners: affectedPartners.length },
      });
    } catch (e) {
      // Ignore if table doesn't exist
    }

    console.log(`[ChargebackAlerts] Completed - ${results.partners_notified} partners notified`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ChargebackAlerts] Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============ HELPER FUNCTIONS ============

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

function translateSplitType(type: string): string {
  const translations: Record<string, string> = {
    affiliate: 'Afiliado',
    coproducer: 'Co-produtor',
    industry: 'Indústria',
    factory: 'Fábrica',
    tenant: 'Lojista',
    platform: 'Plataforma',
  };
  return translations[type] || type;
}

// ============ EMAIL TEMPLATES ============

function getPartnerEmailTemplate(data: {
  partnerName: string;
  partnerType: string;
  orderId: string;
  customerName: string;
  chargebackAmount: string;
  debitedAmount: string;
  balanceAfter: string;
  isNegative: boolean;
  storeName: string;
  reason: string;
}): string {
  const { partnerName, partnerType, orderId, customerName, chargebackAmount, debitedAmount, balanceAfter, isNegative, storeName, reason } = data;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626, #991b1b); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
        .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .negative-warning { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ ALERTA DE CHARGEBACK</h1>
          <p>Um débito foi realizado em sua conta</p>
        </div>
        <div class="content">
          <p>Olá <strong>${partnerName}</strong>,</p>
          
          <div class="alert-box">
            <h3 style="margin: 0 0 15px 0; color: #dc2626;">Chargeback Processado</h3>
            <p>Um cliente solicitou chargeback (disputa de pagamento) e o valor correspondente à sua comissão foi debitado automaticamente da sua carteira.</p>
          </div>

          <h3>Detalhes da Operação</h3>
          <div class="detail-row"><span>Sua Função:</span><strong>${partnerType}</strong></div>
          <div class="detail-row"><span>Pedido:</span><strong>#${orderId}</strong></div>
          <div class="detail-row"><span>Cliente:</span><strong>${customerName}</strong></div>
          <div class="detail-row"><span>Loja:</span><strong>${storeName}</strong></div>
          <div class="detail-row"><span>Valor do Chargeback:</span><strong style="color: #dc2626;">${chargebackAmount}</strong></div>
          <div class="detail-row"><span>Valor Debitado:</span><strong style="color: #dc2626;">-${debitedAmount}</strong></div>
          <div class="detail-row"><span>Saldo Atual:</span><strong style="color: ${isNegative ? '#dc2626' : '#059669'};">${balanceAfter}</strong></div>
          <div class="detail-row"><span>Motivo:</span><strong>${reason}</strong></div>

          ${isNegative ? `
          <div class="negative-warning">
            <strong>⚠️ Atenção: Seu saldo está negativo</strong>
            <p style="margin: 10px 0 0 0;">Suas próximas comissões serão utilizadas para cobrir este débito. Você não poderá realizar saques até regularizar seu saldo.</p>
          </div>
          ` : ''}

          <p style="margin-top: 20px;">Se você acredita que este chargeback é indevido, entre em contato com o suporte da loja para contestação.</p>
        </div>
        <div class="footer">
          <p>Este é um email automático do sistema Morphews.</p>
          <p>Você está recebendo porque é parceiro ativo na plataforma.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getPartnerWhatsAppMessage(data: {
  partnerName: string;
  partnerType: string;
  orderId: string;
  debitedAmount: string;
  balanceAfter: string;
  isNegative: boolean;
}): string {
  const { partnerName, partnerType, orderId, debitedAmount, balanceAfter, isNegative } = data;
  
  let message = `⚠️ *ALERTA DE CHARGEBACK*\n\n`;
  message += `Olá ${partnerName}!\n\n`;
  message += `Um chargeback foi processado e sua comissão foi debitada.\n\n`;
  message += `📋 *Detalhes:*\n`;
  message += `• Função: ${partnerType}\n`;
  message += `• Pedido: #${orderId}\n`;
  message += `• Debitado: *-${debitedAmount}*\n`;
  message += `• Saldo atual: *${balanceAfter}*\n`;
  
  if (isNegative) {
    message += `\n⚠️ *Atenção:* Seu saldo está negativo. Próximas comissões cobrirão este débito.`;
  }
  
  message += `\n\n_Morphews_`;
  
  return message;
}

function getTenantEmailTemplate(data: {
  storeName: string;
  orderId: string;
  customerName: string;
  customerCpf: string;
  chargebackAmount: string;
  affectedPartners: PartnerInfo[];
  reason: string;
  saleDate: string;
}): string {
  const { storeName, orderId, customerName, customerCpf, chargebackAmount, affectedPartners, reason, saleDate } = data;
  
  const partnersList = affectedPartners.map(p => 
    `<tr><td>${p.type}</td><td>${p.name}</td><td style="color: #dc2626;">-${formatCurrency(p.amount_debited)}</td><td style="color: ${p.new_balance < 0 ? '#dc2626' : '#059669'};">${formatCurrency(p.new_balance)}</td></tr>`
  ).join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626, #991b1b); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 CHARGEBACK RECEBIDO</h1>
          <p>Pedido #${orderId}</p>
        </div>
        <div class="content">
          <p>Olá <strong>${storeName}</strong>,</p>
          
          <p>Um chargeback foi registrado para um pedido da sua loja. Todos os valores de comissões foram automaticamente debitados das contas dos parceiros envolvidos.</p>

          <h3>Dados do Pedido</h3>
          <table>
            <tr><td><strong>Pedido:</strong></td><td>#${orderId}</td></tr>
            <tr><td><strong>Data da Venda:</strong></td><td>${saleDate}</td></tr>
            <tr><td><strong>Cliente:</strong></td><td>${customerName}</td></tr>
            <tr><td><strong>CPF:</strong></td><td>${customerCpf}</td></tr>
            <tr><td><strong>Valor:</strong></td><td style="color: #dc2626; font-weight: bold;">${chargebackAmount}</td></tr>
            <tr><td><strong>Motivo:</strong></td><td>${reason}</td></tr>
          </table>

          <h3>Parceiros Afetados</h3>
          <table>
            <thead>
              <tr><th>Tipo</th><th>Nome</th><th>Valor Debitado</th><th>Novo Saldo</th></tr>
            </thead>
            <tbody>
              ${partnersList}
            </tbody>
          </table>

          <h3>Próximos Passos</h3>
          <ol>
            <li>Verifique se há indícios de fraude no pedido</li>
            <li>Contate o cliente para entender a situação</li>
            <li>Avalie a possibilidade de contestação no gateway</li>
            <li>Acompanhe o ticket de SAC criado automaticamente</li>
          </ol>
        </div>
        <div class="footer">
          <p>Este é um email automático do sistema Morphews.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getAdminEmailTemplate(data: {
  storeName: string;
  organizationId: string;
  orderId: string;
  saleId: string;
  customerName: string;
  customerCpf: string;
  chargebackAmount: string;
  affectedPartners: PartnerInfo[];
  gatewayTransactionId: string | null;
  reason: string;
}): string {
  const { storeName, organizationId, orderId, saleId, customerName, customerCpf, chargebackAmount, affectedPartners, gatewayTransactionId, reason } = data;
  
  const totalDebited = affectedPartners.reduce((sum, p) => sum + p.amount_debited, 0);
  const partnersWithNegative = affectedPartners.filter(p => p.new_balance < 0);
  
  const partnersList = affectedPartners.map(p => 
    `<tr>
      <td>${p.type}</td>
      <td>${p.name}</td>
      <td>${p.email || '-'}</td>
      <td style="color: #dc2626;">-${formatCurrency(p.amount_debited)}</td>
      <td style="color: ${p.new_balance < 0 ? '#dc2626; font-weight: bold;' : '#059669'};">${formatCurrency(p.new_balance)}${p.new_balance < 0 ? ' ⚠️' : ''}</td>
    </tr>`
  ).join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #7c3aed, #4c1d95); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat-card { flex: 1; background: #f9fafb; border-radius: 8px; padding: 20px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #dc2626; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
        th { background: #f9fafb; font-weight: 600; }
        .warning-box { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; font-size: 12px; color: #6b7280; }
        code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 [GATEWAY] CHARGEBACK</h1>
          <p>Alerta do Sistema de Pagamentos</p>
        </div>
        <div class="content">
          <div class="stats">
            <div class="stat-card">
              <div class="stat-value">${chargebackAmount}</div>
              <div>Valor do Chargeback</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${affectedPartners.length}</div>
              <div>Parceiros Afetados</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color: ${partnersWithNegative.length > 0 ? '#dc2626' : '#059669'};">${partnersWithNegative.length}</div>
              <div>Saldos Negativos</div>
            </div>
          </div>

          ${partnersWithNegative.length > 0 ? `
          <div class="warning-box">
            <strong>⚠️ ATENÇÃO: ${partnersWithNegative.length} parceiro(s) ficaram com saldo negativo</strong>
            <p style="margin: 10px 0 0 0;">
              ${partnersWithNegative.map(p => `${p.type} "${p.name}": ${formatCurrency(p.new_balance)}`).join(' | ')}
            </p>
          </div>
          ` : ''}

          <h3>Identificadores</h3>
          <table>
            <tr><td><strong>Organização:</strong></td><td>${storeName}</td><td><code>${organizationId}</code></td></tr>
            <tr><td><strong>Pedido:</strong></td><td>#${orderId}</td><td><code>${saleId}</code></td></tr>
            <tr><td><strong>Gateway TX:</strong></td><td colspan="2"><code>${gatewayTransactionId || 'N/A'}</code></td></tr>
          </table>

          <h3>Cliente</h3>
          <table>
            <tr><td><strong>Nome:</strong></td><td>${customerName}</td></tr>
            <tr><td><strong>CPF:</strong></td><td>${customerCpf}</td></tr>
            <tr><td><strong>Motivo:</strong></td><td>${reason}</td></tr>
          </table>

          <h3>Débitos Executados</h3>
          <table>
            <thead>
              <tr><th>Tipo</th><th>Nome</th><th>Email</th><th>Debitado</th><th>Novo Saldo</th></tr>
            </thead>
            <tbody>
              ${partnersList}
            </tbody>
            <tfoot>
              <tr style="background: #f9fafb; font-weight: bold;">
                <td colspan="3">TOTAL DEBITADO</td>
                <td style="color: #dc2626;">${formatCurrency(totalDebited)}</td>
                <td>-</td>
              </tr>
            </tfoot>
          </table>

          <h3>Ações do Gateway Manager</h3>
          <ol>
            <li>Verificar transação no Pagar.me</li>
            <li>Avaliar histórico do cliente/loja</li>
            <li>Monitorar saldos negativos para ação de cobrança</li>
            <li>Documentar caso no ticket de SAC</li>
          </ol>
        </div>
        <div class="footer">
          <p>Sistema de Alertas do Gateway Morphews</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
