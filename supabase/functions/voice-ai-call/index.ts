import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CallRequest {
  organizationId: string;
  leadId?: string;
  phoneNumber: string;
  contactName?: string;
  agentId: string;
  callType: "inbound" | "outbound";
  callPurpose?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: CallRequest = await req.json();
    const { organizationId, leadId, phoneNumber, contactName, agentId, callType, callPurpose } = body;

    if (!organizationId || !phoneNumber || !agentId) {
      throw new Error("Missing required fields: organizationId, phoneNumber, agentId");
    }

    // Get agent config
    const { data: agent, error: agentError } = await supabase
      .from("voice_ai_agents")
      .select("*")
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .single();

    if (agentError || !agent) {
      throw new Error("Agent not found or not accessible");
    }

    // Create call record
    const { data: callRecord, error: callError } = await supabase
      .from("voice_ai_calls")
      .insert({
        organization_id: organizationId,
        lead_id: leadId,
        phone_number: phoneNumber,
        contact_name: contactName,
        agent_id: agent.elevenlabs_agent_id,
        agent_name: agent.name,
        voice_id: agent.voice_id,
        call_type: callType,
        call_purpose: callPurpose,
        status: "pending",
      })
      .select()
      .single();

    if (callError) {
      console.error("Error creating call record:", callError);
      throw new Error("Failed to create call record");
    }

    // Get conversation token for WebRTC
    const tokenResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agent.elevenlabs_agent_id}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      }
    );

    if (!tokenResponse.ok) {
      // Update call status to failed
      await supabase
        .from("voice_ai_calls")
        .update({ status: "failed", error_message: "Failed to get conversation token" })
        .eq("id", callRecord.id);

      throw new Error("Failed to get conversation token from ElevenLabs");
    }

    const tokenData = await tokenResponse.json();

    // Update call status to ringing
    await supabase
      .from("voice_ai_calls")
      .update({ status: "ringing", started_at: new Date().toISOString() })
      .eq("id", callRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        callId: callRecord.id,
        token: tokenData.token,
        agent: {
          id: agent.elevenlabs_agent_id,
          name: agent.name,
          voiceId: agent.voice_id,
          firstMessage: agent.first_message,
          language: agent.language,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error initiating voice call:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
