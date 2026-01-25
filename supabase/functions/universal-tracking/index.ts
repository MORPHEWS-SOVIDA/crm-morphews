import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// UNIVERSAL TRACKING - SERVER-SIDE CONVERSION API
// Unified endpoint for all e-commerce modules:
// - Landing Pages
// - Storefronts
// - Standalone Checkouts
// - Quizzes
// Sends events to Meta CAPI, TikTok Events API, Google GA4
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrackingPayload {
  organization_id: string;
  source: 'landing_page' | 'storefront' | 'standalone_checkout' | 'quiz';
  source_id?: string;
  source_name?: string;
  event_type: 'ViewContent' | 'Lead' | 'InitiateCheckout' | 'AddPaymentInfo' | 'Purchase';
  event_id: string;
  // Customer data (will be hashed)
  email?: string;
  phone?: string;
  name?: string;
  // Tracking IDs
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  fbc?: string;
  fbp?: string;
  // Client info
  client_user_agent?: string;
  client_ip?: string;
  event_source_url?: string;
  // Transaction data
  value_cents?: number;
  currency?: string;
  sale_id?: string;
  content_name?: string;
  content_category?: string;
}

// SHA256 hash for PII
async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Normalize phone to E.164 (Brazil)
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

// Map event types for different platforms
function mapEventToMeta(eventType: string): string {
  const map: Record<string, string> = {
    'ViewContent': 'ViewContent',
    'Lead': 'Lead',
    'InitiateCheckout': 'InitiateCheckout',
    'AddPaymentInfo': 'AddPaymentInfo',
    'Purchase': 'Purchase',
  };
  return map[eventType] || eventType;
}

function mapEventToTikTok(eventType: string): string {
  const map: Record<string, string> = {
    'ViewContent': 'ViewContent',
    'Lead': 'SubmitForm',
    'InitiateCheckout': 'InitiateCheckout',
    'AddPaymentInfo': 'AddPaymentInfo',
    'Purchase': 'CompletePayment',
  };
  return map[eventType] || eventType;
}

function mapEventToGA4(eventType: string): string {
  const map: Record<string, string> = {
    'ViewContent': 'view_item',
    'Lead': 'generate_lead',
    'InitiateCheckout': 'begin_checkout',
    'AddPaymentInfo': 'add_payment_info',
    'Purchase': 'purchase',
  };
  return map[eventType] || eventType;
}

// ============================================================
// META CONVERSIONS API (Facebook)
// ============================================================
async function sendToMeta(
  config: any,
  payload: TrackingPayload
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
    
    // Click IDs for attribution
    if (payload.fbc) {
      userData.fbc = payload.fbc;
    } else if (payload.fbclid) {
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
      event_id: payload.event_id,
      action_source: "website",
      user_data: userData,
    };

    if (payload.event_source_url) {
      eventData.event_source_url = payload.event_source_url;
    }

    // Custom data
    eventData.custom_data = {
      content_name: payload.content_name || payload.source_name,
      content_category: payload.content_category || payload.source,
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

    console.log("Sending to Meta CAPI:", { event: eventData.event_name, event_id: payload.event_id });

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

// ============================================================
// TIKTOK EVENTS API
// ============================================================
async function sendToTikTok(
  config: any,
  payload: TrackingPayload
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

    const eventData = {
      event: mapEventToTikTok(payload.event_type),
      event_time: Math.floor(Date.now() / 1000),
      event_id: payload.event_id,
      user: userData,
      properties: {
        content_name: payload.content_name || payload.source_name,
        content_type: payload.content_category || payload.source,
        currency: payload.currency || "BRL",
        value: payload.value_cents ? payload.value_cents / 100 : 0,
      },
      page: {
        url: payload.event_source_url,
      },
    };

    const url = `https://business-api.tiktok.com/open_api/v1.3/pixel/track/`;

    console.log("Sending to TikTok:", { event: eventData.event, event_id: payload.event_id });

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
      console.error("TikTok error:", result);
      return { success: false, error: JSON.stringify(result), response: result };
    }

    console.log("TikTok success:", result);
    return { success: true, response: result };
  } catch (error: any) {
    console.error("TikTok exception:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// GOOGLE GA4 MEASUREMENT PROTOCOL
// ============================================================
async function sendToGoogle(
  config: any,
  payload: TrackingPayload
): Promise<{ success: boolean; response?: any; error?: string }> {
  if (!config.google_enabled || !config.google_measurement_id || !config.google_api_secret) {
    return { success: false, error: "Google não configurado" };
  }

  try {
    // GA4 Measurement Protocol
    const clientId = payload.event_id.split('_')[0] || `${Date.now()}.${Math.random()}`;
    
    const eventParams: any = {
      content_name: payload.content_name || payload.source_name,
      source: payload.source,
    };

    if (payload.value_cents && payload.value_cents > 0) {
      eventParams.currency = payload.currency || "BRL";
      eventParams.value = payload.value_cents / 100;
    }

    if (payload.sale_id) {
      eventParams.transaction_id = payload.sale_id;
    }

    const body = {
      client_id: clientId,
      events: [{
        name: mapEventToGA4(payload.event_type),
        params: eventParams,
      }],
    };

    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${config.google_measurement_id}&api_secret=${config.google_api_secret}`;

    console.log("Sending to GA4:", { event: mapEventToGA4(payload.event_type), event_id: payload.event_id });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // GA4 returns 204 on success with no body
    if (response.status === 204 || response.ok) {
      console.log("GA4 success");
      return { success: true };
    }

    const result = await response.text();
    console.error("GA4 error:", result);
    return { success: false, error: result };
  } catch (error: any) {
    console.error("GA4 exception:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: TrackingPayload = await req.json();

    // Extract client IP from request
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("cf-connecting-ip") 
      || null;
    
    if (clientIp) {
      payload.client_ip = clientIp;
    }

    if (!payload.organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[UniversalTracking] Received:", { 
      source: payload.source,
      event: payload.event_type, 
      org: payload.organization_id,
      event_id: payload.event_id,
    });

    // Fetch tracking config for organization
    const { data: config } = await supabase
      .from("tracking_config")
      .select("*")
      .eq("organization_id", payload.organization_id)
      .maybeSingle();

    if (!config) {
      console.log("[UniversalTracking] No tracking config found for org:", payload.organization_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Configuração de tracking não encontrada",
          results: {},
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any = {};

    // Send to Meta CAPI
    if (config.meta_enabled) {
      results.meta = await sendToMeta(config, payload);

      // Log conversion event
      await supabase.from("conversion_events").insert({
        organization_id: payload.organization_id,
        sale_id: payload.sale_id || null,
        event_type: payload.event_type,
        platform: "meta",
        event_id: payload.event_id,
        payload: payload,
        response: results.meta.response,
        status: results.meta.success ? "sent" : "failed",
        error_message: results.meta.error,
        sent_at: results.meta.success ? new Date().toISOString() : null,
      });
    }

    // Send to TikTok
    if (config.tiktok_enabled) {
      results.tiktok = await sendToTikTok(config, payload);

      await supabase.from("conversion_events").insert({
        organization_id: payload.organization_id,
        sale_id: payload.sale_id || null,
        event_type: payload.event_type,
        platform: "tiktok",
        event_id: payload.event_id,
        payload: payload,
        response: results.tiktok.response,
        status: results.tiktok.success ? "sent" : "failed",
        error_message: results.tiktok.error,
        sent_at: results.tiktok.success ? new Date().toISOString() : null,
      });
    }

    // Send to Google
    if (config.google_enabled) {
      results.google = await sendToGoogle(config, payload);

      await supabase.from("conversion_events").insert({
        organization_id: payload.organization_id,
        sale_id: payload.sale_id || null,
        event_type: payload.event_type,
        platform: "google",
        event_id: payload.event_id,
        payload: payload,
        response: results.google.response,
        status: results.google.success ? "sent" : "failed",
        error_message: results.google.error,
        sent_at: results.google.success ? new Date().toISOString() : null,
      });
    }

    console.log("[UniversalTracking] Results:", results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[UniversalTracking] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
