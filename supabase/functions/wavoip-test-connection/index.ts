import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// Wavoip SaaS API base URL
const WAVOIP_API_URL = "https://api.wavoip.com";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      return jsonResponse({ ok: false, error: "Não autenticado" });
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ ok: false, error: "Não autenticado" });
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const deviceToken = body?.deviceToken as string | undefined;

    if (!deviceToken) {
      return jsonResponse({ ok: false, error: "deviceToken é obrigatório" });
    }

    console.log("wavoip-test-connection: testing token", { 
      tokenPrefix: deviceToken.substring(0, 20) + "..." 
    });

    // Test connection to Wavoip SaaS API
    // Try to get device/account status
    const testUrl = `${WAVOIP_API_URL}/v1/device/status`;

    const response = await fetch(testUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${deviceToken}`,
        "Content-Type": "application/json",
      },
    });

    const rawText = await response.text();
    let data: unknown = rawText;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      // keep as text
    }

    console.log("wavoip-test-connection: response", { 
      ok: response.ok, 
      status: response.status,
      data: typeof data === 'string' ? data.substring(0, 200) : data,
    });

    if (response.ok) {
      return jsonResponse({
        ok: true,
        message: "Token válido! Conexão com Wavoip funcionando.",
        device: data,
      });
    }

    // Handle specific error cases
    if (response.status === 401 || response.status === 403) {
      return jsonResponse({
        ok: false,
        error: "Token inválido ou expirado. Verifique o token no painel Wavoip.",
      });
    }

    if (response.status === 404) {
      // Endpoint might not exist yet - try alternative
      // Some Wavoip implementations use different endpoints
      const altUrl = `${WAVOIP_API_URL}/v1/account`;
      const altResponse = await fetch(altUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${deviceToken}`,
          "Content-Type": "application/json",
        },
      });

      if (altResponse.ok) {
        return jsonResponse({
          ok: true,
          message: "Token válido! Conexão com Wavoip funcionando.",
        });
      }

      // If still failing, assume token format is correct but can't verify
      // Return success with warning
      if (deviceToken.length > 20) {
        return jsonResponse({
          ok: true,
          message: "Token salvo. Não foi possível verificar a conexão, mas o formato parece correto.",
          warning: true,
        });
      }
    }

    return jsonResponse({
      ok: false,
      error: "Não foi possível validar o token. Verifique se está correto.",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("wavoip-test-connection error:", msg);
    return jsonResponse({ ok: false, error: msg });
  }
});
