import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EndCallRequest {
  callId: string;
  transcript?: string;
  summary?: string;
  sentiment?: "positive" | "neutral" | "negative" | "mixed";
  outcome?: string;
  outcomeNotes?: string;
  nextAction?: string;
  nextActionDate?: string;
  durationSeconds?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: EndCallRequest = await req.json();
    const { 
      callId, 
      transcript, 
      summary, 
      sentiment, 
      outcome, 
      outcomeNotes,
      nextAction,
      nextActionDate,
      durationSeconds 
    } = body;

    if (!callId) {
      throw new Error("Call ID is required");
    }

    // Update call record
    const { data: callRecord, error: updateError } = await supabase
      .from("voice_ai_calls")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        transcript,
        summary,
        sentiment,
        outcome,
        outcome_notes: outcomeNotes,
        next_action: nextAction,
        next_action_date: nextActionDate,
        duration_seconds: durationSeconds,
      })
      .eq("id", callId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating call record:", updateError);
      throw new Error("Failed to update call record");
    }

    // If there's a next action with a lead, create a follow-up task
    if (callRecord.lead_id && nextAction && nextActionDate) {
      // Could create a task/reminder here in the future
      console.log("Next action scheduled:", nextAction, "for", nextActionDate);
    }

    return new Response(
      JSON.stringify({
        success: true,
        call: callRecord,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error ending voice call:", error);
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
