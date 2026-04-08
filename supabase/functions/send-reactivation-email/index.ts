import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emails } = await req.json();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada");

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const email of emails) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Atomic IA <noreply@atomic.ia.br>",
            to: [email],
            subject: "🎉 Sua conta foi reativada! Bom uso",
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    
    <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🚀 Conta Reativada!</h1>
    </div>
    
    <div style="padding: 32px;">
      <p style="color: #18181b; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
        Olá! 👋
      </p>
      <p style="color: #3f3f46; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        Sua conta na <strong>Atomic IA</strong> foi reativada com sucesso! Você tem mais <strong>30 dias</strong> para aproveitar todos os recursos.
      </p>
      
      <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 0 8px 8px 0; margin: 0 0 24px;">
        <p style="color: #166534; font-size: 14px; margin: 0;">
          ✅ <strong>50.000 energias</strong> disponíveis<br>
          ✅ <strong>3 instâncias</strong> de WhatsApp liberadas<br>
          ✅ Acesso completo por <strong>30 dias</strong>
        </p>
      </div>
      
      <div style="text-align: center; margin: 0 0 24px;">
        <a href="https://atomic.ia.br/login" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
          Acessar Atomic IA →
        </a>
      </div>
      
      <p style="color: #71717a; font-size: 13px; line-height: 1.5; margin: 0; border-top: 1px solid #e4e4e7; padding-top: 20px;">
        Caso tenha esquecido sua senha, use o botão <strong>"Esqueci minha senha"</strong> na tela de login para redefinir.
      </p>
    </div>
    
    <div style="background: #fafafa; padding: 16px 32px; text-align: center; border-top: 1px solid #e4e4e7;">
      <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
        © 2026 Atomic IA — Todos os direitos reservados
      </p>
    </div>
  </div>
</body>
</html>`,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          results.push({ email, success: false, error: errText });
        } else {
          results.push({ email, success: true });
        }

        // Small delay between sends
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        results.push({ email, success: false, error: err instanceof Error ? err.message : "Unknown" });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-reactivation-email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
