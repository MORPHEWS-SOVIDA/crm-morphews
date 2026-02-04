import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY not configured");
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say language="pt-BR">Desculpe, o sistema não está configurado corretamente. Por favor, tente novamente mais tarde.</Say>
          <Hangup/>
        </Response>`,
        { headers: { "Content-Type": "application/xml" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse Twilio webhook data
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const callStatus = formData.get("CallStatus") as string;

    console.log(`Incoming call: ${callSid} from ${from} to ${to} - Status: ${callStatus}`);

    // Normalize the "to" number for lookup
    const normalizedTo = to.replace(/\D/g, "");
    const normalizedToWithPlus = to.startsWith("+") ? to : `+${normalizedTo}`;

    // Find the phone number allocation
    const { data: allocation, error: allocationError } = await supabase
      .from("voice_number_allocations")
      .select(`
        *,
        voice_phone_numbers!inner(*)
      `)
      .or(`phone_number.eq.${normalizedToWithPlus},phone_number.eq.${to}`, { foreignTable: "voice_phone_numbers" })
      .eq("status", "active")
      .maybeSingle();

    if (allocationError) {
      console.error("Error finding allocation:", allocationError);
    }

    if (!allocation) {
      console.log("No active allocation found for number:", to);
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say language="pt-BR">Este número não está configurado para receber chamadas. Por favor, entre em contato por outro canal.</Say>
          <Hangup/>
        </Response>`,
        { headers: { "Content-Type": "application/xml" } }
      );
    }

    const organizationId = allocation.organization_id;

    // Find the Voice AI agent for this organization
    const { data: agent, error: agentError } = await supabase
      .from("voice_ai_agents")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (agentError) {
      console.error("Error finding agent:", agentError);
    }

    if (!agent || !agent.elevenlabs_agent_id) {
      console.log("No active Voice AI agent found for org:", organizationId);
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say language="pt-BR">Desculpe, o atendente virtual não está disponível no momento. Por favor, tente novamente mais tarde.</Say>
          <Hangup/>
        </Response>`,
        { headers: { "Content-Type": "application/xml" } }
      );
    }

    // Create call log entry
    const { data: callLog, error: logError } = await supabase
      .from("voice_call_logs")
      .insert({
        organization_id: organizationId,
        phone_number_id: allocation.phone_number_id,
        twilio_call_sid: callSid,
        direction: "inbound",
        from_number: from,
        to_number: to,
        status: "ringing",
        agent_id: agent.id,
        agent_name: agent.name,
      })
      .select()
      .single();

    if (logError) {
      console.error("Error creating call log:", logError);
    }

    // Get ElevenLabs conversation token
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
      const errorText = await tokenResponse.text();
      console.error("ElevenLabs token error:", errorText);
      
      // Update call log
      if (callLog) {
        await supabase
          .from("voice_call_logs")
          .update({ status: "failed", error_message: "Failed to get ElevenLabs token" })
          .eq("id", callLog.id);
      }

      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say language="pt-BR">Desculpe, não foi possível conectar ao atendente virtual. Por favor, tente novamente.</Say>
          <Hangup/>
        </Response>`,
        { headers: { "Content-Type": "application/xml" } }
      );
    }

    const tokenData = await tokenResponse.json();
    const conversationToken = tokenData.token;

    // Update call log to in_progress
    if (callLog) {
      await supabase
        .from("voice_call_logs")
        .update({ 
          status: "in_progress", 
          started_at: new Date().toISOString(),
          elevenlabs_conversation_id: conversationToken 
        })
        .eq("id", callLog.id);
    }

    // Build TwiML to connect to ElevenLabs via WebSocket
    // Note: ElevenLabs Conversational AI uses WebSocket streaming
    // Twilio <Stream> connects to ElevenLabs WebSocket endpoint
    const streamUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agent.elevenlabs_agent_id}`;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="${streamUrl}">
          <Parameter name="xi-api-key" value="${ELEVENLABS_API_KEY}"/>
        </Stream>
      </Connect>
    </Response>`;

    console.log("Connecting call to ElevenLabs agent:", agent.elevenlabs_agent_id);

    return new Response(twiml, {
      headers: { "Content-Type": "application/xml" },
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say language="pt-BR">Ocorreu um erro no sistema. Por favor, tente novamente mais tarde.</Say>
        <Hangup/>
      </Response>`,
      { headers: { "Content-Type": "application/xml" } }
    );
  }
});
