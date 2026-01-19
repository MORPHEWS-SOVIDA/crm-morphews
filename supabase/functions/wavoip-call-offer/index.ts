import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// Fallback global Evolution credentials (optional). Prefer per-instance fields.
const FALLBACK_EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") ?? "";
const FALLBACK_EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeUrl(url: string) {
  return url.replace(/\/+$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return jsonResponse({ ok: false, error: "Não autenticado" }, 401);

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse({ ok: false, error: "Backend auth config missing" }, 500);
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) return jsonResponse({ ok: false, error: "Não autenticado" }, 401);

    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const instanceId = body?.instanceId as string | undefined;
    const number = body?.number as string | undefined;
    const isVideo = Boolean(body?.isVideo);
    const callDuration = typeof body?.callDuration === "number" ? body.callDuration : 30;

    if (!instanceId) return jsonResponse({ ok: false, error: "instanceId é obrigatório" }, 400);
    if (!number) return jsonResponse({ ok: false, error: "number é obrigatório" }, 400);

    const { data: instance, error: instanceError } = await supabaseAdmin
      .from("whatsapp_instances")
      .select(
        "id, organization_id, name, evolution_instance_id, wavoip_enabled, wavoip_server_url, wavoip_api_key, evolution_api_token"
      )
      .eq("id", instanceId)
      .single();

    if (instanceError || !instance) {
      return jsonResponse({ ok: false, error: "Instância não encontrada" }, 404);
    }

    if (!instance.wavoip_enabled) {
      return jsonResponse({ ok: false, error: "Chamadas não habilitadas para esta instância" }, 400);
    }

    const { data: perm, error: permError } = await supabaseAdmin
      .from("whatsapp_instance_users")
      .select("id, can_use_phone, can_view, organization_id")
      .eq("instance_id", instanceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (permError || !perm?.can_view || !perm?.can_use_phone) {
      return jsonResponse({ ok: false, error: "Sem permissão de telefone para esta instância" }, 403);
    }

    // Extra guard: enforce same organization.
    if (perm.organization_id && instance.organization_id && perm.organization_id !== instance.organization_id) {
      return jsonResponse({ ok: false, error: "Sem permissão para esta organização" }, 403);
    }

    const serverUrl = normalizeUrl(String(instance.wavoip_server_url || FALLBACK_EVOLUTION_API_URL || ""));
    const apiKey = String(instance.wavoip_api_key || instance.evolution_api_token || FALLBACK_EVOLUTION_API_KEY || "");

    if (!serverUrl) return jsonResponse({ ok: false, error: "Servidor de chamadas não configurado" }, 500);
    if (!apiKey) return jsonResponse({ ok: false, error: "Chave de autenticação do servidor não configurada" }, 500);

    const instanceName = String(instance.evolution_instance_id || instance.name);
    const upstreamUrl = `${serverUrl}/call/offer/${encodeURIComponent(instanceName)}`;

    const upstreamResp = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({ number, isVideo, callDuration }),
    });

    const rawText = await upstreamResp.text();
    let raw: unknown = rawText;
    try {
      raw = rawText ? JSON.parse(rawText) : {};
    } catch {
      // keep as text
    }

    // Always return 200 so the frontend can handle upstream errors deterministically.
    return jsonResponse({
      ok: upstreamResp.ok,
      upstreamStatus: upstreamResp.status,
      instanceName,
      raw,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("wavoip-call-offer error:", msg);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
