import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html } = await req.json();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Atomic Sales <vendas@updates.atomic.ia.br>",
        to: [to],
        subject: subject || "🧪 Email de Teste - Atomic Sales",
        html: html || `
          <!DOCTYPE html>
          <html>
          <body style="font-family: 'Segoe UI', sans-serif; background: #f4f4f4; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 30px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 28px;">Atomic Sales</h1>
              </div>
              <div style="padding: 40px 30px;">
                <h2 style="color: #1f2937; margin: 0 0 20px;">✅ Email de Teste</h2>
                <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                  Olá! Este é um email de teste enviado em <strong>${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</strong>.
                </p>
                <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                  Se você está recebendo este email, o sistema de envio está funcionando corretamente! 🎉
                </p>
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <p style="color: #166534; margin: 0; font-size: 14px;">
                    <strong>Remetente:</strong> vendas@updates.atomic.ia.br<br>
                    <strong>Domínio:</strong> updates.atomic.ia.br<br>
                    <strong>Provedor:</strong> Resend
                  </p>
                </div>
              </div>
              <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2024 Atomic Sales</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const data = await emailResponse.json();
    console.log("Resend response:", JSON.stringify(data));

    if (!emailResponse.ok) {
      throw new Error(`Resend error: ${JSON.stringify(data)}`);
    }

    return new Response(
      JSON.stringify({ success: true, resend_response: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
