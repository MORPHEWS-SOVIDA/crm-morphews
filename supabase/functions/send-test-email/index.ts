import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const { to } = await req.json();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "Atomic Sales <vendas@updates.atomic.ia.br>",
      to: [to],
      subject: "🧪 Teste - Sistema de Email Funcionando!",
      html: "<div style='font-family:sans-serif;max-width:600px;margin:0 auto;padding:30px;background:#fff;border-radius:12px'><div style='background:linear-gradient(135deg,#f97316,#ea580c);padding:30px;text-align:center;border-radius:12px 12px 0 0'><h1 style='color:#fff;margin:0'>Atomic Sales</h1></div><div style='padding:30px'><h2 style='color:#1f2937'>✅ Email de Teste</h2><p style='color:#4b5563;font-size:16px'>Este é um email de teste enviado em <strong>" + new Date().toISOString() + "</strong>.</p><p style='color:#4b5563;font-size:16px'>Sistema de envio funcionando! 🎉</p></div></div>"
    }),
  });

  const data = await res.json();
  console.log("Resend response:", res.status, JSON.stringify(data));

  return new Response(JSON.stringify({ status: res.status, data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
