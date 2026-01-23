import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// SERVER-SIDE CONVERSIONS API
// Envia eventos de conversão para Meta (Facebook) e Google Ads
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConversionPayload {
  sale_id: string;
  event_type: "Purchase" | "Lead" | "InitiateCheckout" | "AddToCart";
  // Dados do cliente
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  // Dados da transação
  value_cents: number;
  currency?: string;
  // Tracking IDs
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  // UTM
  utm_source?: string;
  utm_campaign?: string;
  // Client info
  client_ip?: string;
  client_user_agent?: string;
  event_source_url?: string;
}

// Hash SHA256 para dados de usuário (Meta exige)
async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Normaliza telefone para formato E.164
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

// Envia para Meta Conversions API
async function sendToMeta(
  config: any,
  payload: ConversionPayload,
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
    if (payload.first_name) {
      userData.fn = [await hashData(payload.first_name)];
    }
    if (payload.last_name) {
      userData.ln = [await hashData(payload.last_name)];
    }
    if (payload.fbclid) {
      userData.fbc = `fb.1.${Date.now()}.${payload.fbclid}`;
    }
    if (payload.client_ip) {
      userData.client_ip_address = payload.client_ip;
    }
    if (payload.client_user_agent) {
      userData.client_user_agent = payload.client_user_agent;
    }

    const eventData: any = {
      event_name: payload.event_type,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: "website",
      user_data: userData,
    };

    if (payload.event_source_url) {
      eventData.event_source_url = payload.event_source_url;
    }

    if (payload.value_cents > 0) {
      eventData.custom_data = {
        currency: payload.currency || "BRL",
        value: payload.value_cents / 100,
      };
    }

    const body: any = {
      data: [eventData],
    };

    if (config.meta_test_event_code) {
      body.test_event_code = config.meta_test_event_code;
    }

    const url = `https://graph.facebook.com/v18.0/${config.meta_pixel_id}/events?access_token=${config.meta_access_token}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: JSON.stringify(result), response: result };
    }

    return { success: true, response: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Envia para Google Ads Offline Conversions
async function sendToGoogle(
  config: any,
  payload: ConversionPayload,
  eventId: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  if (!config.google_enabled || !config.google_ads_customer_id || !payload.gclid) {
    return { success: false, error: "Google não configurado ou gclid ausente" };
  }

  // Google Ads Offline Conversion requer OAuth, por ora retornamos placeholder
  // A implementação completa exige Google OAuth refresh token
  console.log("Google Ads conversion would be sent:", {
    customer_id: config.google_ads_customer_id,
    gclid: payload.gclid,
    conversion_action_id: config.google_conversion_action_id,
    value: payload.value_cents / 100,
    event_id: eventId,
  });

  return { 
    success: false, 
    error: "Google Ads Offline Conversion requer OAuth - implementação pendente" 
  };
}

// Envia para TikTok Events API
async function sendToTikTok(
  config: any,
  payload: ConversionPayload,
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

    const eventData = {
      event: payload.event_type === "Purchase" ? "CompletePayment" : payload.event_type,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      user: userData,
      properties: {
        currency: payload.currency || "BRL",
        value: payload.value_cents / 100,
      },
    };

    const url = `https://business-api.tiktok.com/open_api/v1.3/pixel/track/`;

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
      return { success: false, error: JSON.stringify(result), response: result };
    }

    return { success: true, response: result };
  } catch (error: any) {
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

    const payload: ConversionPayload = await req.json();

    if (!payload.sale_id) {
      return new Response(
        JSON.stringify({ error: "sale_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar venda e organização
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select(`
        *,
        leads(name, email, whatsapp),
        organizations(id)
      `)
      .eq("id", payload.sale_id)
      .single();

    if (saleError || !sale) {
      return new Response(
        JSON.stringify({ error: "Venda não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar config de tracking
    const { data: config } = await supabase
      .from("tracking_config")
      .select("*")
      .eq("organization_id", sale.organization_id)
      .single();

    if (!config) {
      return new Response(
        JSON.stringify({ error: "Configuração de tracking não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Preparar payload enriquecido
    const enrichedPayload: ConversionPayload = {
      ...payload,
      email: payload.email || sale.leads?.email,
      phone: payload.phone || sale.leads?.whatsapp,
      first_name: payload.first_name || sale.leads?.name?.split(" ")[0],
      last_name: payload.last_name || sale.leads?.name?.split(" ").slice(1).join(" "),
      value_cents: payload.value_cents || sale.total_cents || 0,
      fbclid: payload.fbclid || sale.fbclid,
      gclid: payload.gclid || sale.gclid,
      ttclid: payload.ttclid || sale.ttclid,
      utm_source: payload.utm_source || sale.utm_source,
      utm_campaign: payload.utm_campaign || sale.utm_campaign,
    };

    const eventId = `${sale.id}_${Date.now()}`;
    const results: any = {};

    // Enviar para Meta
    if (config.meta_enabled) {
      const metaResult = await sendToMeta(config, enrichedPayload, eventId);
      results.meta = metaResult;

      await supabase.from("conversion_events").insert({
        organization_id: sale.organization_id,
        sale_id: sale.id,
        lead_id: sale.lead_id,
        event_type: payload.event_type,
        platform: "meta",
        event_id: eventId,
        payload: enrichedPayload,
        response: metaResult.response,
        status: metaResult.success ? "sent" : "failed",
        error_message: metaResult.error,
        sent_at: metaResult.success ? new Date().toISOString() : null,
      });
    }

    // Enviar para Google
    if (config.google_enabled && enrichedPayload.gclid) {
      const googleResult = await sendToGoogle(config, enrichedPayload, eventId);
      results.google = googleResult;

      await supabase.from("conversion_events").insert({
        organization_id: sale.organization_id,
        sale_id: sale.id,
        lead_id: sale.lead_id,
        event_type: payload.event_type,
        platform: "google",
        event_id: eventId,
        payload: enrichedPayload,
        response: googleResult.response,
        status: googleResult.success ? "sent" : "failed",
        error_message: googleResult.error,
        sent_at: googleResult.success ? new Date().toISOString() : null,
      });
    }

    // Enviar para TikTok
    if (config.tiktok_enabled) {
      const tiktokResult = await sendToTikTok(config, enrichedPayload, eventId);
      results.tiktok = tiktokResult;

      await supabase.from("conversion_events").insert({
        organization_id: sale.organization_id,
        sale_id: sale.id,
        lead_id: sale.lead_id,
        event_type: payload.event_type,
        platform: "tiktok",
        event_id: eventId,
        payload: enrichedPayload,
        response: tiktokResult.response,
        status: tiktokResult.success ? "sent" : "failed",
        error_message: tiktokResult.error,
        sent_at: tiktokResult.success ? new Date().toISOString() : null,
      });
    }

    // Atualizar sale com flags de envio
    await supabase
      .from("sales")
      .update({
        conversion_sent_to_meta: results.meta?.success || false,
        conversion_sent_to_google: results.google?.success || false,
        conversion_sent_at: new Date().toISOString(),
      })
      .eq("id", sale.id);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in server-side-conversions:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});