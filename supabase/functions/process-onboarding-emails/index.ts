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

// Replace variables in email content
function replaceVariables(content: string, vars: Record<string, string>): string {
  let result = content;
  
  // Replace {{nome}} with full name
  if (vars.nome) {
    result = result.replace(/\{\{nome\}\}/g, vars.nome);
  }
  
  // Replace {{primeiro_nome}} with first name
  if (vars.nome) {
    const firstName = vars.nome.split(" ")[0];
    result = result.replace(/\{\{primeiro_nome\}\}/g, firstName);
  }
  
  // Replace {{empresa}} with company name
  if (vars.empresa) {
    result = result.replace(/\{\{empresa\}\}/g, vars.empresa);
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
        from: "Atomic Sales <noreply@atomic.ia.br>",
        to: [to],
        subject,
        html: wrapEmailTemplate(htmlContent),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Resend API error:", errorData);
      return { 
        success: false, 
        error: errorData.message || `HTTP ${response.status}` 
      };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Send email error:", msg);
    return { success: false, error: msg };
  }
}

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
    h2 { color: #667eea; }
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
     <p>Você está recebendo este email porque se cadastrou no Atomic Sales.</p>
  </div>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = new Date().toISOString();
    console.log(`📧 Processing onboarding emails at ${now}`);

    // Get pending emails that are due
    const { data: pendingEmails, error: fetchError } = await supabase
      .from("onboarding_email_queue")
      .select(`
        id,
        email,
        name,
        organization_id,
        template_id,
        onboarding_email_templates (
          subject,
          body_html
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch pending emails: ${fetchError.message}`);
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log("📭 No pending emails to process");
      return new Response(
        JSON.stringify({ ok: true, message: "No pending emails", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📬 Found ${pendingEmails.length} emails to process`);

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const email of pendingEmails) {
      const template = email.onboarding_email_templates as any;
      
      if (!template) {
        console.log(`⚠️ Template not found for email ${email.id}`);
        await supabase
          .from("onboarding_email_queue")
          .update({ 
            status: "failed", 
            error_message: "Template not found" 
          })
          .eq("id", email.id);
        failedCount++;
        continue;
      }

      // Get organization name for variable replacement
      let orgName = "sua empresa";
      if (email.organization_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", email.organization_id)
          .maybeSingle();
        if (org?.name) {
          orgName = org.name;
        }
      }

      // Replace variables
      const subject = replaceVariables(template.subject, {
        nome: email.name || "Usuário",
        empresa: orgName,
      });

      const body = replaceVariables(template.body_html, {
        nome: email.name || "Usuário",
        empresa: orgName,
      });

      // Send email
      const result = await sendEmail(email.email, subject, body);

      if (result.success) {
        await supabase
          .from("onboarding_email_queue")
          .update({ 
            status: "sent", 
            sent_at: new Date().toISOString() 
          })
          .eq("id", email.id);
        
        sentCount++;
        console.log(`✅ Sent email to ${email.email}`);
      } else {
        await supabase
          .from("onboarding_email_queue")
          .update({ 
            status: "failed", 
            error_message: result.error 
          })
          .eq("id", email.id);
        
        failedCount++;
        errors.push(`${email.email}: ${result.error}`);
        console.error(`❌ Failed to send to ${email.email}: ${result.error}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`📊 Processed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        ok: true,
        processed: pendingEmails.length,
        sent: sentCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Process onboarding emails error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
