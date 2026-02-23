import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

// Internal secret for service-to-service calls
const INTERNAL_SECRET = Deno.env.get("INTERNAL_AUTH_SECRET");

interface WhiteLabelBranding {
  brand_name: string;
  logo_url: string | null;
  primary_color: string;
  email_from_name: string | null;
  support_email: string | null;
  support_whatsapp: string | null;
}

interface WelcomeEmailRequest {
  email: string;
  name: string;
  password: string;
  planName: string;
  whiteLabelBranding?: WhiteLabelBranding;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate internal secret - only other edge functions can call this
    const internalSecret = req.headers.get("x-internal-secret");
    if (!INTERNAL_SECRET || internalSecret !== INTERNAL_SECRET) {
      console.error("Unauthorized: Invalid or missing internal secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { email, name, password, planName, whiteLabelBranding }: WelcomeEmailRequest = await req.json();

    console.log("Sending welcome email to:", email);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const loginUrl = "https://atomic.ia.br/login";
    
    // Use white label branding if provided, otherwise use Morphews defaults
    const brandName = whiteLabelBranding?.brand_name || "Atomic Sales";
    const primaryColor = whiteLabelBranding?.primary_color || "#667eea";
    const secondaryColor = "#764ba2";
    const fromName = whiteLabelBranding?.email_from_name || brandName;
    const supportInfo = whiteLabelBranding?.support_whatsapp 
      ? `Precisa de ajuda? Entre em contato pelo WhatsApp: ${whiteLabelBranding.support_whatsapp}`
      : "Precisa de ajuda? Entre em contato pelo WhatsApp";
    
    // Build logo or text header
    const logoSection = whiteLabelBranding?.logo_url 
      ? `<img src="${whiteLabelBranding.logo_url}" alt="${brandName}" style="max-height: 40px; margin-bottom: 10px;" />`
      : "";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          ${logoSection}
          <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Parabéns, ${name}!</h1>
          <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Sua assinatura do plano ${planName} foi confirmada!</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px;">
          <h2 style="color: #333; margin-top: 0;">Suas credenciais de acesso:</h2>
          
          <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>📧 E-mail:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>🔑 Senha provisória:</strong> <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 16px;">${password}</code></p>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">⚠️ <strong>Importante:</strong> Por segurança, altere sua senha após o primeiro login em Configurações.</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${loginUrl}" style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Acessar o Sistema</a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          
          <p style="color: #666; font-size: 14px; text-align: center; margin: 0;">
            ${supportInfo}<br>
            <strong>${brandName}</strong> - Transforme seus leads em clientes
          </p>
        </div>
      </body>
      </html>
    `;

    // Use verified Morphews domain for sending, but customize display name
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${fromName} <noreply@atomic.ia.br>`,
        to: [email],
        subject: `🎉 Bem-vindo ao ${brandName} - Suas credenciais de acesso`,
        html: emailHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      throw new Error(data.message || "Failed to send email");
    }

    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
