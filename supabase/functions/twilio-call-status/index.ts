import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse Twilio status callback
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const callStatus = formData.get("CallStatus") as string;
    const callDuration = formData.get("CallDuration") as string;
    const timestamp = formData.get("Timestamp") as string;

    console.log(`Call status update: ${callSid} - ${callStatus} - Duration: ${callDuration}s`);

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      "queued": "queued",
      "ringing": "ringing",
      "in-progress": "in_progress",
      "completed": "completed",
      "busy": "busy",
      "failed": "failed",
      "no-answer": "no_answer",
      "canceled": "canceled",
    };

    const mappedStatus = statusMap[callStatus] || callStatus;

    // Update the call log
    const updateData: Record<string, unknown> = {
      status: mappedStatus,
    };

    if (callDuration) {
      updateData.duration_seconds = parseInt(callDuration, 10);
    }

    if (["completed", "busy", "failed", "no-answer", "canceled"].includes(callStatus)) {
      updateData.ended_at = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
      
      // Calculate energy consumption for completed calls
      if (callStatus === "completed" && callDuration) {
        const durationSeconds = parseInt(callDuration, 10);
        const minutes = Math.ceil(durationSeconds / 60);
        // 50⚡ base + 500⚡/min (as per voice-ai-system-v1 memory)
        const energyConsumed = 50 + (minutes * 500);
        updateData.energy_consumed = energyConsumed;
      }
    }

    const { error } = await supabase
      .from("voice_call_logs")
      .update(updateData)
      .eq("twilio_call_sid", callSid);

    if (error) {
      console.error("Error updating call log:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Status callback error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
