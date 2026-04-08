import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Email templates for payment reminders
const EMAIL_TEMPLATES = {
  day_3: {
    subject: "⚠️ Ação necessária: Seu pagamento está pendente",
    content: `
      <h1>Olá {{nome}}!</h1>
      <p>Notamos que o pagamento da sua assinatura do <strong>Atomic Sales</strong> não foi processado.</p>
      <p>Para evitar a interrupção do seu acesso, pedimos que regularize o pagamento o mais rápido possível.</p>
      
      <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <strong>⚠️ Importante:</strong><br/>
        Seu acesso pode ser suspenso em breve se o pagamento não for regularizado.
      </div>
      
      <p>Para atualizar seus dados de pagamento:</p>
      <ol>
        <li>Acesse o CRM normalmente</li>
        <li>Vá em <strong>Minha Equipe</strong> → <strong>Minha Assinatura</strong></li>
        <li>Clique em <strong>"Gerenciar Assinatura"</strong></li>
      </ol>
      
      <p>Se precisar de ajuda, responda este email ou fale conosco pelo WhatsApp.</p>
      
      <p>Atenciosamente,<br/><strong>Equipe Atomic Sales</strong></p>
    `,
  },
  day_7: {
    subject: "🚨 Último aviso: Sua assinatura será suspensa",
    content: `
      <h1>Olá {{nome}}!</h1>
      <p>Este é um <strong>aviso urgente</strong> sobre sua assinatura do Atomic Sales.</p>
      
      <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <strong>🚨 Atenção:</strong><br/>
        Seu pagamento está pendente há mais de 7 dias. <strong>Sua conta será suspensa em breve.</strong>
      </div>
      
      <p>Com a suspensão, você perderá acesso a:</p>
      <ul>
        <li>Todos os seus leads e histórico</li>
        <li>Automações de WhatsApp</li>
        <li>Robôs de IA configurados</li>
        <li>Dados de vendas e financeiro</li>
      </ul>
      
      <p><strong>Regularize agora para evitar a perda de acesso:</strong></p>
      <ol>
        <li>Acesse o CRM: <a href="https://atomic.ia.br">atomic.ia.br</a></li>
        <li>Vá em <strong>Minha Equipe</strong> → <strong>Minha Assinatura</strong></li>
        <li>Clique em <strong>"Gerenciar Assinatura"</strong></li>
      </ol>
      
      <p>Se você já regularizou o pagamento, por favor desconsidere este email.</p>
      
      <p>Estamos à disposição para ajudar.<br/><strong>Equipe Atomic Sales</strong></p>
    `,
  },
  day_14: {
    subject: "❌ Sua conta foi suspensa por falta de pagamento",
    content: `
      <h1>Olá {{nome}}!</h1>
      <p>Infelizmente, sua conta no <strong>Atomic Sales</strong> foi suspensa por falta de pagamento.</p>
      
      <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <strong>❌ Conta Suspensa</strong><br/>
        O acesso ao sistema foi bloqueado até a regularização do pagamento.
      </div>
      
      <p><strong>Seus dados estão seguros!</strong> Ao regularizar o pagamento, você terá acesso novamente a tudo:</p>
      <ul>
        <li>Leads e histórico de conversas</li>
        <li>Configurações de robôs e automações</li>
        <li>Dados de vendas e financeiro</li>
      </ul>
      
      <p>Para reativar sua conta, entre em contato conosco pelo WhatsApp ou responda este email.</p>
      
      <p>Sentimos sua falta!<br/><strong>Equipe Atomic Sales</strong></p>
    `,
  },
};

// Wrap content in email template
function wrapEmailTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: #f8f9fa;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px 30px;
      border-radius: 12px 12px 0 0;
      text-align: center;
    }
    .header img {
      max-width: 180px;
      height: auto;
    }
    .content {
      background: white;
      padding: 30px;
      border-radius: 0 0 12px 12px;
    }
    h1 { color: #333; margin-top: 0; }
    a { color: #667eea; }
    ul, ol { padding-left: 20px; }
    li { margin-bottom: 8px; }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="https://atomic.ia.br/images/logo-atomic-email.png" alt="Atomic Sales" />
  </div>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Atomic Sales - Todos os direitos reservados</p>
  </div>
</body>
</html>
  `;
}

// Replace variables in email content
function replaceVariables(content: string, vars: Record<string, string>): string {
  let result = content;
  if (vars.nome) {
    result = result.replace(/\{\{nome\}\}/g, vars.nome);
    const firstName = vars.nome.split(" ")[0];
    result = result.replace(/\{\{primeiro_nome\}\}/g, firstName);
  }
  return result;
}

// Send email via Resend
async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Atomic Sales <noreply@updates.atomic.ia.br>",
        to: [to],
        subject,
        html: wrapEmailTemplate(htmlContent),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Resend API error:", errorData);
      return { success: false, error: errorData.message || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Send email error:", msg);
    return { success: false, error: msg };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = new Date();
    console.log(`💳 Processing payment reminders at ${now.toISOString()}`);

    // Get all subscriptions with past_due status
    const { data: pastDueSubscriptions, error: subError } = await supabase
      .from("subscriptions")
      .select(`
        id,
        organization_id,
        status,
        current_period_end,
        organizations (
          id,
          name,
          owner_name,
          owner_email
        )
      `)
      .eq("status", "past_due");

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }

    console.log(`Found ${pastDueSubscriptions?.length || 0} past_due subscriptions`);

    // Get already sent reminders
    const { data: sentReminders } = await supabase
      .from("payment_reminder_log")
      .select("*");

    const sentReminderMap = new Map<string, Set<string>>();
    sentReminders?.forEach((r) => {
      if (!sentReminderMap.has(r.organization_id)) {
        sentReminderMap.set(r.organization_id, new Set());
      }
      sentReminderMap.get(r.organization_id)!.add(r.reminder_type);
    });

    let sentCount = 0;
    let errorCount = 0;

    for (const sub of pastDueSubscriptions || []) {
      const org = sub.organizations as any;
      if (!org?.owner_email) {
        console.log(`Skipping org ${sub.organization_id}: no owner email`);
        continue;
      }

      // Calculate days since payment was due
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
      if (!periodEnd) {
        console.log(`Skipping org ${sub.organization_id}: no period end date`);
        continue;
      }

      const daysSinceDue = Math.floor((now.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`Org ${org.name}: ${daysSinceDue} days since due`);

      const alreadySent = sentReminderMap.get(sub.organization_id) || new Set();

      // Determine which reminder to send
      let reminderType: string | null = null;
      let template: { subject: string; content: string } | null = null;

      if (daysSinceDue >= 14 && !alreadySent.has("day_14")) {
        reminderType = "day_14";
        template = EMAIL_TEMPLATES.day_14;
      } else if (daysSinceDue >= 7 && !alreadySent.has("day_7")) {
        reminderType = "day_7";
        template = EMAIL_TEMPLATES.day_7;
      } else if (daysSinceDue >= 3 && !alreadySent.has("day_3")) {
        reminderType = "day_3";
        template = EMAIL_TEMPLATES.day_3;
      }

      if (reminderType && template) {
        const content = replaceVariables(template.content, {
          nome: org.owner_name || "Cliente",
        });

        const result = await sendEmail(org.owner_email, template.subject, content);

        if (result.success) {
          // Log the sent reminder
          await supabase.from("payment_reminder_log").insert({
            organization_id: sub.organization_id,
            reminder_type: reminderType,
            sent_to: org.owner_email,
          });
          
          console.log(`✅ Sent ${reminderType} reminder to ${org.owner_email}`);
          sentCount++;
        } else {
          console.error(`❌ Failed to send to ${org.owner_email}: ${result.error}`);
          errorCount++;
        }
      }
    }

    console.log(`📧 Completed: ${sentCount} sent, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        errors: errorCount,
        processed: pastDueSubscriptions?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Payment reminders error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
