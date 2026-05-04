import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FINANCE_EMAIL = "financeiro.sovida@gmail.com";

function fmt(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { withdrawalId } = await req.json();
    if (!withdrawalId) throw new Error("withdrawalId required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: w, error } = await supabase
      .from("withdrawal_requests")
      .select(`*, virtual_account:virtual_accounts(*, bank_data:virtual_account_bank_data(*))`)
      .eq("id", withdrawalId)
      .single();

    if (error || !w) throw new Error(error?.message || "Withdrawal not found");

    const acc = (w as any).virtual_account || {};
    const bank = (w as any).bank_data || acc.bank_data?.find((b: any) => b.is_primary) || acc.bank_data?.[0] || {};
    const requesterName = acc.holder_name || "Usuário";
    const requesterEmail = acc.holder_email || "—";

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");

    const subject = `PEDIDO DE SAQUE: ${requesterName}`;
    const html = `
<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#222;max-width:640px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 16px;color:#6d28d9;">💰 Novo Pedido de Saque</h2>
  <p style="color:#555;">Um novo pedido de saque foi solicitado e aguarda aprovação.</p>

  <h3 style="margin-top:24px;border-bottom:1px solid #eee;padding-bottom:6px;">Solicitante</h3>
  <table style="width:100%;font-size:14px;">
    <tr><td style="padding:4px 0;color:#666;width:160px;">Nome:</td><td><b>${requesterName}</b></td></tr>
    <tr><td style="padding:4px 0;color:#666;">E-mail:</td><td>${requesterEmail}</td></tr>
    <tr><td style="padding:4px 0;color:#666;">CPF/CNPJ:</td><td>${acc.holder_document || "—"}</td></tr>
    <tr><td style="padding:4px 0;color:#666;">Tipo de conta:</td><td>${acc.account_type || "—"}</td></tr>
  </table>

  <h3 style="margin-top:24px;border-bottom:1px solid #eee;padding-bottom:6px;">Valores</h3>
  <table style="width:100%;font-size:14px;">
    <tr><td style="padding:4px 0;color:#666;width:160px;">Valor solicitado:</td><td>${fmt(w.amount_cents)}</td></tr>
    <tr><td style="padding:4px 0;color:#666;">Taxa:</td><td>${fmt(w.fee_cents)}</td></tr>
    <tr><td style="padding:4px 0;color:#666;">Valor líquido a transferir:</td><td><b style="color:#059669;font-size:16px;">${fmt(w.net_amount_cents)}</b></td></tr>
  </table>

  <h3 style="margin-top:24px;border-bottom:1px solid #eee;padding-bottom:6px;">Dados Bancários</h3>
  <table style="width:100%;font-size:14px;">
    <tr><td style="padding:4px 0;color:#666;width:160px;">Banco:</td><td>${bank.bank_code || ""} - ${bank.bank_name || "—"}</td></tr>
    <tr><td style="padding:4px 0;color:#666;">Agência:</td><td>${bank.agency || "—"}</td></tr>
    <tr><td style="padding:4px 0;color:#666;">Conta:</td><td>${bank.account_number || "—"} (${bank.account_type === "savings" ? "Poupança" : "Corrente"})</td></tr>
    <tr><td style="padding:4px 0;color:#666;">Titular:</td><td>${bank.holder_name || "—"}</td></tr>
    <tr><td style="padding:4px 0;color:#666;">CPF/CNPJ titular:</td><td>${bank.holder_document || "—"}</td></tr>
    ${bank.pix_key ? `<tr><td style="padding:4px 0;color:#666;">PIX (${bank.pix_key_type || ""}):</td><td><b>${bank.pix_key}</b></td></tr>` : ""}
  </table>

  <h3 style="margin-top:24px;border-bottom:1px solid #eee;padding-bottom:6px;">Pedido</h3>
  <table style="width:100%;font-size:14px;">
    <tr><td style="padding:4px 0;color:#666;width:160px;">ID:</td><td><code>${w.id}</code></td></tr>
    <tr><td style="padding:4px 0;color:#666;">Solicitado em:</td><td>${new Date(w.requested_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td></tr>
    <tr><td style="padding:4px 0;color:#666;">Status:</td><td>${w.status}</td></tr>
  </table>

  <div style="margin-top:24px;padding:12px;background:#f5f3ff;border-radius:8px;font-size:13px;color:#5b21b6;">
    Acesse o painel Super Admin para aprovar ou rejeitar este pedido.
  </div>
</body></html>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Atomic Sales <financeiro@atomic.ia.br>",
        to: [FINANCE_EMAIL],
        reply_to: requesterEmail !== "—" ? requesterEmail : undefined,
        subject,
        html,
      }),
    });

    const result = await resp.json();
    if (!resp.ok) {
      console.error("Resend error:", result);
      throw new Error(result?.message || "Resend send failed");
    }

    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    console.error("notify-withdrawal-request error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
