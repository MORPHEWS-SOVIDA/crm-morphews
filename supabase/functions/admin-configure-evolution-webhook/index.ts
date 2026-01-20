import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function configureEvolutionWebhook(params: {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
  webhookUrl: string;
}) {
  const baseUrl = params.apiUrl.replace(/\/$/, "");
  const endpoint = `${baseUrl}/webhook/set/${encodeURIComponent(params.instanceName)}`;

  // Try v2 payload (docs)
  const payloadV2 = {
    enabled: true,
    url: params.webhookUrl,
    webhookByEvents: false,
    webhookBase64: true,
    events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
  };

  // Try legacy payload (observed in older deployments)
  const payloadLegacy = {
    url: params.webhookUrl,
    byEvents: false,
    base64: true,
    headers: { "Content-Type": "application/json" },
    events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
  };

  const attempt = async (variant: "v2" | "legacy", payload: Record<string, unknown>) => {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: params.apiKey,
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text().catch(() => "");
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return {
      variant,
      ok: resp.ok,
      status: resp.status,
      bodyText: text.slice(0, 4000),
      bodyJson: json,
      sentPayload: payload,
    };
  };

  const v2Res = await attempt("v2", payloadV2);
  if (v2Res.ok) return v2Res;

  const legacyRes = await attempt("legacy", payloadLegacy);
  if (legacyRes.ok) return legacyRes;

  return { ok: false, endpoint, attempts: [v2Res, legacyRes] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return jsonResponse({ ok: false, error: "Não autenticado" }, 401);

    // Validate user via anon client
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ ok: false, error: "Não autenticado" }, 401);
    }

    // Admin client for privileged reads
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: isMasterAdmin, error: masterErr } = await supabaseAdmin.rpc("is_master_admin", {
      _user_id: userData.user.id,
    });

    if (masterErr || !isMasterAdmin) {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }

    // Load admin WhatsApp instance config
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", "admin_whatsapp_instance")
      .maybeSingle();

    if (settingsErr) {
      return jsonResponse({ ok: false, error: "Falha ao ler configurações" }, 500);
    }

    const value = settings?.value as any;
    const apiUrl = String(value?.api_url || "");
    const apiKey = String(value?.api_key || "");
    const instanceName = String(value?.instance_name || "");

    if (!apiUrl || !apiKey || !instanceName) {
      return jsonResponse(
        { ok: false, error: "Configuração incompleta da instância administrativa" },
        400
      );
    }

    const webhookUrl = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/evolution-webhook`;

    const res = await configureEvolutionWebhook({ apiUrl, apiKey, instanceName, webhookUrl });

    if ((res as any).ok) {
      return jsonResponse({ ok: true, instanceName, webhookUrl, result: res });
    }

    return jsonResponse({ ok: false, instanceName, webhookUrl, result: res }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
