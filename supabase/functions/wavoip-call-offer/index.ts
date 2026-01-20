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

// Wavoip SaaS API base URL
const WAVOIP_API_URL = "https://api.wavoip.com";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Always return 200 so frontend can handle errors gracefully
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed", code: 405 });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return jsonResponse({ ok: false, error: "Não autenticado", code: 401 });

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse({ ok: false, error: "Backend auth config missing", code: 500 });
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) return jsonResponse({ ok: false, error: "Não autenticado", code: 401 });

    const userId = userData.user.id;

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const instanceId = body?.instanceId as string | undefined;
    const number = body?.number as string | undefined;
    const isVideo = Boolean(body?.isVideo);
    const callDuration = typeof body?.callDuration === "number" ? body.callDuration : 30;

    if (!instanceId) return jsonResponse({ ok: false, error: "instanceId é obrigatório", code: 400 });
    if (!number) return jsonResponse({ ok: false, error: "number é obrigatório", code: 400 });

    console.log("wavoip-call-offer: request", { instanceId, userId, isVideo, callDuration });

    // Fetch instance with Wavoip device token
    const { data: instance, error: instanceError } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("id, organization_id, name, wavoip_enabled, wavoip_device_token")
      .eq("id", instanceId)
      .single();

    if (instanceError || !instance) {
      console.log("wavoip-call-offer: instance not found", { instanceId, instanceError });
      return jsonResponse({ ok: false, error: "Instância não encontrada", code: 404 });
    }

    if (!instance.wavoip_enabled) {
      return jsonResponse({ ok: false, error: "Chamadas não habilitadas para esta instância", code: 400 });
    }

    if (!instance.wavoip_device_token) {
      return jsonResponse({ 
        ok: false, 
        error: "Token Wavoip não configurado. Acesse as configurações da instância.", 
        code: 400 
      });
    }

    // Check user permission
    const { data: perm, error: permError } = await supabaseAdmin
      .from("whatsapp_instance_users")
      .select("id, can_use_phone, can_view")
      .eq("instance_id", instanceId)
      .eq("user_id", userId)
      .maybeSingle();

    console.log("wavoip-call-offer: perm check", { instanceId, userId, perm, permError });

    if (permError || !perm?.can_view || !perm?.can_use_phone) {
      console.log("wavoip-call-offer: permission denied", { instanceId, userId, permError, perm });
      return jsonResponse({ ok: false, error: "Sem permissão de telefone para esta instância", code: 403 });
    }

    // Make call via Wavoip SaaS API
    // Documentation: https://docs.wavoip.com (adjust endpoint as per actual docs)
    const wavoipUrl = `${WAVOIP_API_URL}/v1/calls/offer`;

    console.log("wavoip-call-offer: calling Wavoip SaaS", { wavoipUrl, number: number.substring(0, 8) + "..." });

    const upstreamResp = await fetch(wavoipUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${instance.wavoip_device_token}`,
      },
      body: JSON.stringify({
        number: number,
        isVideo: isVideo,
        duration: callDuration,
      }),
    });

    const rawText = await upstreamResp.text();
    let raw: unknown = rawText;
    try {
      raw = rawText ? JSON.parse(rawText) : {};
    } catch {
      // keep as text
    }

    console.log("wavoip-call-offer: upstream response", { 
      ok: upstreamResp.ok, 
      status: upstreamResp.status,
      raw: typeof raw === 'string' ? raw.substring(0, 200) : raw,
    });

    // Return result
    return jsonResponse({
      ok: upstreamResp.ok,
      upstreamStatus: upstreamResp.status,
      instanceName: instance.name,
      raw,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("wavoip-call-offer error:", msg);
    return jsonResponse({ ok: false, error: msg, code: 500 });
  }
});
