import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// QUIZ TRACKING SERVER-SIDE API
// Envia eventos de quiz para Meta CAPI, Google e TikTok Events API
// Funciona com ou sem sale_id (para Lead, ViewContent, CompleteRegistration)
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuizTrackingPayload {
  quiz_id: string;
  session_id: string;
  organization_id: string;
  event_type: "ViewContent" | "Lead" | "CompleteRegistration" | "InitiateCheckout";
  event_id?: string; // Para deduplicação
  // Dados do lead
  email?: string;
  phone?: string;
  name?: string;
  // Tracking IDs do browser
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  fbc?: string; // Cookie _fbc
  fbp?: string; // Cookie _fbp
  // Client info
  client_ip?: string;
  client_user_agent?: string;
  event_source_url?: string;
  // Valor (para eventos de checkout)
  value_cents?: number;
  currency?: string;
  // Extra data
  quiz_name?: string;
  step_title?: string;
  total_score?: number;
}

// Hash SHA256 para dados de usuário (Meta exige)
async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Normaliza telefone brasileiro para formato E.164
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    return `55${cleaned.slice(1)}`;
  }
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `55${cleaned}`;
  }
  if (cleaned.startsWith("55") && cleaned.length >= 12) {
    return cleaned;
  }
  return cleaned;
}

// Mapear event_type do quiz para Meta
function mapEventToMeta(eventType: string): string {
  const map: Record<string, string> = {
    "ViewContent": "ViewContent",
    "Lead": "Lead",
    "CompleteRegistration": "CompleteRegistration",
    "InitiateCheckout": "InitiateCheckout",
  };
  return map[eventType] || eventType;
}

// Mapear event_type do quiz para TikTok
function mapEventToTikTok(eventType: string): string {
  const map: Record<string, string> = {
    "ViewContent": "ViewContent",
    "Lead": "SubmitForm",
    "CompleteRegistration": "CompleteRegistration",
    "InitiateCheckout": "InitiateCheckout",
  };
  return map[eventType] || eventType;
}

// Envia para Meta Conversions API
async function sendToMeta(
  config: any,
  payload: QuizTrackingPayload,
  eventId: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  if (!config.meta_enabled || !config.meta_pixel_id || !config.meta_access_token) {
    return { success: false, error: "Meta não configurado" };
  }

  try {
    const userData: any = {};
    
    if (payload.email) {
      userData.em = [await hashData(payload.email)];
    }
    if (payload.phone) {
      userData.ph = [await hashData(normalizePhone(payload.phone))];
    }
    if (payload.name) {
      const nameParts = payload.name.split(" ");
      userData.fn = [await hashData(nameParts[0] || "")];
      if (nameParts.length > 1) {
        userData.ln = [await hashData(nameParts.slice(1).join(" "))];
      }
    }
    
    // Click IDs e cookies para atribuição
    if (payload.fbc) {
      userData.fbc = payload.fbc;
    } else if (payload.fbclid) {
      // Construir fbc a partir do fbclid
      userData.fbc = `fb.1.${Date.now()}.${payload.fbclid}`;
    }
    if (payload.fbp) {
      userData.fbp = payload.fbp;
    }
    if (payload.client_ip) {
      userData.client_ip_address = payload.client_ip;
    }
    if (payload.client_user_agent) {
      userData.client_user_agent = payload.client_user_agent;
    }

    const eventData: any = {
      event_name: mapEventToMeta(payload.event_type),
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: "website",
      user_data: userData,
    };

    if (payload.event_source_url) {
      eventData.event_source_url = payload.event_source_url;
    }

    // Custom data para contexto
    eventData.custom_data = {
      content_name: payload.quiz_name,
      content_category: "Quiz",
    };

    if (payload.value_cents && payload.value_cents > 0) {
      eventData.custom_data.currency = payload.currency || "BRL";
      eventData.custom_data.value = payload.value_cents / 100;
    }

    const body: any = {
      data: [eventData],
    };

    if (config.meta_test_event_code) {
      body.test_event_code = config.meta_test_event_code;
    }

    const url = `https://graph.facebook.com/v18.0/${config.meta_pixel_id}/events?access_token=${config.meta_access_token}`;

    console.log("Sending to Meta CAPI:", { url: url.split("?")[0], event: eventData.event_name, event_id: eventId });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Meta CAPI error:", result);
      return { success: false, error: JSON.stringify(result), response: result };
    }

    console.log("Meta CAPI success:", result);
    return { success: true, response: result };
  } catch (error: any) {
    console.error("Meta CAPI exception:", error);
    return { success: false, error: error.message };
  }
}

// Envia para TikTok Events API
async function sendToTikTok(
  config: any,
  payload: QuizTrackingPayload,
  eventId: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  if (!config.tiktok_enabled || !config.tiktok_pixel_id || !config.tiktok_access_token) {
    return { success: false, error: "TikTok não configurado" };
  }

  try {
    const userData: any = {};
    
    if (payload.email) {
      userData.email = await hashData(payload.email);
    }
    if (payload.phone) {
      userData.phone = await hashData(normalizePhone(payload.phone));
    }
    if (payload.ttclid) {
      userData.ttclid = payload.ttclid;
    }
    if (payload.client_ip) {
      userData.ip = payload.client_ip;
    }
    if (payload.client_user_agent) {
      userData.user_agent = payload.client_user_agent;
    }

    const eventData: any = {
      event: mapEventToTikTok(payload.event_type),
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      user: userData,
      properties: {
        content_name: payload.quiz_name,
        content_type: "quiz",
      },
    };

    if (payload.value_cents && payload.value_cents > 0) {
      eventData.properties.currency = payload.currency || "BRL";
      eventData.properties.value = payload.value_cents / 100;
    }

    if (payload.event_source_url) {
      eventData.page = {
        url: payload.event_source_url,
      };
    }

    const url = `https://business-api.tiktok.com/open_api/v1.3/event/track/`;

    console.log("Sending to TikTok Events API:", { event: eventData.event, event_id: eventId });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": config.tiktok_access_token,
      },
      body: JSON.stringify({
        pixel_code: config.tiktok_pixel_id,
        data: [eventData],
      }),
    });

    const result = await response.json();

    if (!response.ok || result.code !== 0) {
      console.error("TikTok Events API error:", result);
      return { success: false, error: JSON.stringify(result), response: result };
    }

    console.log("TikTok Events API success:", result);
    return { success: true, response: result };
  } catch (error: any) {
    console.error("TikTok Events API exception:", error);
    return { success: false, error: error.message };
  }
}

// Envia para Google Analytics 4 Measurement Protocol
async function sendToGoogle(
  config: any,
  payload: QuizTrackingPayload,
  eventId: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  // Google Measurement Protocol para GA4
  if (!config.google_enabled || !config.google_measurement_id || !config.google_api_secret) {
    return { success: false, error: "Google não configurado" };
  }

  try {
    const eventData: any = {
      name: payload.event_type.toLowerCase(),
      params: {
        quiz_name: payload.quiz_name,
        engagement_time_msec: 1000,
      },
    };

    if (payload.gclid) {
      eventData.params.gclid = payload.gclid;
    }
    if (payload.value_cents && payload.value_cents > 0) {
      eventData.params.currency = payload.currency || "BRL";
      eventData.params.value = payload.value_cents / 100;
    }

    const body = {
      client_id: payload.session_id,
      events: [eventData],
    };

    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${config.google_measurement_id}&api_secret=${config.google_api_secret}`;

    console.log("Sending to Google GA4 MP:", { event: eventData.name, client_id: payload.session_id });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // GA4 MP returns 204 No Content on success
    if (response.status === 204 || response.ok) {
      console.log("Google GA4 MP success");
      return { success: true, response: { status: response.status } };
    }

    const result = await response.text();
    console.error("Google GA4 MP error:", result);
    return { success: false, error: result };
  } catch (error: any) {
    console.error("Google GA4 MP exception:", error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: QuizTrackingPayload = await req.json();

    // Extrair IP do request se não fornecido
    if (!payload.client_ip) {
      const forwardedFor = req.headers.get("x-forwarded-for");
      const realIp = req.headers.get("x-real-ip");
      payload.client_ip = forwardedFor?.split(",")[0]?.trim() || realIp || undefined;
    }

    // Validação mínima
    if (!payload.quiz_id || !payload.organization_id || !payload.event_type) {
      return new Response(
        JSON.stringify({ error: "quiz_id, organization_id e event_type são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar config de tracking da organização
    const { data: config } = await supabase
      .from("tracking_config")
      .select("*")
      .eq("organization_id", payload.organization_id)
      .single();

    if (!config) {
      // Sem config de tracking, retornar sucesso silencioso
      return new Response(
        JSON.stringify({ success: true, message: "Tracking não configurado para esta organização" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gerar event_id para deduplicação se não fornecido
    const eventId = payload.event_id || `quiz_${payload.session_id}_${payload.event_type}_${Date.now()}`;

    const results: any = {};

    // Enviar para Meta CAPI
    if (config.meta_enabled) {
      results.meta = await sendToMeta(config, payload, eventId);

      // Log do evento (sem sale_id)
      await supabase.from("conversion_events").insert({
        organization_id: payload.organization_id,
        event_type: payload.event_type,
        platform: "meta",
        event_id: eventId,
        payload: payload,
        response: results.meta.response,
        status: results.meta.success ? "sent" : "failed",
        error_message: results.meta.error,
        sent_at: results.meta.success ? new Date().toISOString() : null,
      });
    }

    // Enviar para TikTok
    if (config.tiktok_enabled) {
      results.tiktok = await sendToTikTok(config, payload, eventId);

      await supabase.from("conversion_events").insert({
        organization_id: payload.organization_id,
        event_type: payload.event_type,
        platform: "tiktok",
        event_id: eventId,
        payload: payload,
        response: results.tiktok.response,
        status: results.tiktok.success ? "sent" : "failed",
        error_message: results.tiktok.error,
        sent_at: results.tiktok.success ? new Date().toISOString() : null,
      });
    }

    // Enviar para Google
    if (config.google_enabled) {
      results.google = await sendToGoogle(config, payload, eventId);

      await supabase.from("conversion_events").insert({
        organization_id: payload.organization_id,
        event_type: payload.event_type,
        platform: "google",
        event_id: eventId,
        payload: payload,
        response: results.google.response,
        status: results.google.success ? "sent" : "failed",
        error_message: results.google.error,
        sent_at: results.google.success ? new Date().toISOString() : null,
      });
    }

    return new Response(
      JSON.stringify({ success: true, event_id: eventId, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in quiz-tracking:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
