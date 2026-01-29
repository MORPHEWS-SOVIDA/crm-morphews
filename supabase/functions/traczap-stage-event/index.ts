import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * TracZAP Stage Event - Dispara eventos CAPI quando lead muda de etapa
 * 
 * Este é o coração do TracZAP. Quando um lead muda de etapa no funil,
 * este endpoint envia o evento configurado para o Meta Ads via CAPI.
 */

interface StageEventPayload {
  lead_id: string;
  organization_id: string;
  from_stage_id?: string;
  to_stage_id: string;
  history_id?: string; // ID do registro em lead_stage_history para atualizar
}

// Hash SHA-256 for Meta CAPI
async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55") && digits.length <= 11) {
    digits = "55" + digits;
  }
  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: StageEventPayload = await req.json();
    const { lead_id, organization_id, to_stage_id, history_id } = payload;

    console.log(`[TracZAP] Processing stage change for lead ${lead_id} to stage ${to_stage_id}`);

    // 1. Get the target stage configuration
    const { data: stage, error: stageError } = await supabase
      .from('organization_funnel_stages')
      .select('id, name, capi_event_name, capi_custom_event')
      .eq('id', to_stage_id)
      .single();

    if (stageError || !stage) {
      console.log(`[TracZAP] Stage not found: ${to_stage_id}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Stage not found' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check if this stage has a CAPI event configured
    const capiEventName = stage.capi_event_name || stage.capi_custom_event;
    
    if (!capiEventName) {
      console.log(`[TracZAP] No CAPI event configured for stage "${stage.name}"`);
      return new Response(
        JSON.stringify({ success: true, message: 'No CAPI event for this stage' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[TracZAP] Will send event "${capiEventName}" for stage "${stage.name}"`);

    // 3. Get lead data for event
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name, email, whatsapp, utm_source, utm_campaign, fbclid, gclid, first_touch_url')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      console.error(`[TracZAP] Lead not found: ${lead_id}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Get tracking config for organization
    const { data: trackingConfig } = await supabase
      .from('tracking_configs')
      .select('meta_pixel_id, meta_access_token, meta_enabled, meta_test_event_code')
      .eq('organization_id', organization_id)
      .single();

    if (!trackingConfig?.meta_enabled || !trackingConfig?.meta_pixel_id || !trackingConfig?.meta_access_token) {
      console.log(`[TracZAP] Meta tracking not configured for organization ${organization_id}`);
      
      // Update history to mark as not sent (no config)
      if (history_id) {
        await supabase
          .from('lead_stage_history')
          .update({ 
            capi_event_sent: false,
            capi_event_name: capiEventName,
          })
          .eq('id', history_id);
      }
      
      return new Response(
        JSON.stringify({ success: true, message: 'Meta tracking not configured' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Build Meta CAPI event
    const eventId = `traczap_${lead_id}_${to_stage_id}_${Date.now()}`;
    
    const userData: Record<string, unknown> = {};
    
    if (lead.email) {
      userData.em = [await hashData(lead.email)];
    }
    if (lead.whatsapp) {
      userData.ph = [await hashData(normalizePhone(lead.whatsapp))];
    }
    if (lead.name) {
      const nameParts = lead.name.split(" ");
      userData.fn = [await hashData(nameParts[0] || "")];
      if (nameParts.length > 1) {
        userData.ln = [await hashData(nameParts.slice(1).join(" "))];
      }
    }
    
    // Click IDs for attribution
    if (lead.fbclid) {
      userData.fbc = `fb.1.${Date.now()}.${lead.fbclid}`;
    }

    const eventData: Record<string, unknown> = {
      event_name: capiEventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: "system_generated",
      user_data: userData,
      custom_data: {
        content_name: stage.name,
        content_category: "funnel_stage",
        lead_id: lead_id,
      },
    };

    if (lead.first_touch_url) {
      eventData.event_source_url = lead.first_touch_url;
    }

    const body: Record<string, unknown> = {
      data: [eventData],
    };

    if (trackingConfig.meta_test_event_code) {
      body.test_event_code = trackingConfig.meta_test_event_code;
    }

    // 6. Send to Meta CAPI
    const url = `https://graph.facebook.com/v18.0/${trackingConfig.meta_pixel_id}/events?access_token=${trackingConfig.meta_access_token}`;

    console.log(`[TracZAP] Sending ${capiEventName} event to Meta CAPI...`);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    const success = response.ok;

    console.log(`[TracZAP] Meta CAPI response:`, { success, result });

    // 7. Update history record with result
    if (history_id) {
      await supabase
        .from('lead_stage_history')
        .update({ 
          capi_event_sent: success,
          capi_event_name: capiEventName,
          capi_event_id: eventId,
        })
        .eq('id', history_id);
    }

    // 8. Log conversion event
    await supabase
      .from('conversion_events')
      .insert({
        organization_id,
        lead_id,
        platform: 'meta',
        event_type: capiEventName,
        event_id: eventId,
        status: success ? 'sent' : 'error',
        payload: body,
        response: result,
        sent_at: new Date().toISOString(),
        error_message: success ? null : JSON.stringify(result),
      });

    return new Response(
      JSON.stringify({
        success,
        event_name: capiEventName,
        event_id: eventId,
        stage_name: stage.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[TracZAP] Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
