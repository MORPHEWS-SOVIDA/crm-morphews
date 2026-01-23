import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TriggerPayload {
  trigger_type: 'abandoned_cart' | 'post_purchase' | 'lead_created' | 'recompra' | 'manual';
  organization_id: string;
  lead_id?: string;
  email: string;
  triggered_by?: string; // cart_id, sale_id, etc.
  conditions?: Record<string, unknown>;
}

/**
 * Email Sequence Trigger
 * 
 * Enrolls a lead/email into an email sequence based on trigger type.
 * Called from other functions (checkout, webhooks, etc.)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: TriggerPayload = await req.json();
    const { trigger_type, organization_id, lead_id, email, triggered_by, conditions } = payload;

    console.log(`📧 Triggering ${trigger_type} sequence for ${email}`);

    // Find active sequence for this trigger
    const { data: sequences, error: seqError } = await supabase
      .from('email_sequences')
      .select('id, trigger_conditions')
      .eq('organization_id', organization_id)
      .eq('trigger_type', trigger_type)
      .eq('is_active', true);

    if (seqError) throw seqError;

    if (!sequences?.length) {
      console.log(`No active sequences for trigger ${trigger_type}`);
      return new Response(
        JSON.stringify({ success: true, message: 'No sequences found' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find matching sequence based on conditions
    let matchedSequence = sequences[0]; // Default to first
    
    for (const seq of sequences) {
      const seqConditions = seq.trigger_conditions as Record<string, unknown> || {};
      
      // Check if all conditions match
      let matches = true;
      for (const [key, value] of Object.entries(seqConditions)) {
        if (conditions && conditions[key] !== value) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        matchedSequence = seq;
        break;
      }
    }

    // Check if already enrolled in this sequence
    const { data: existing } = await supabase
      .from('email_sequence_enrollments')
      .select('id')
      .eq('sequence_id', matchedSequence.id)
      .eq('email', email)
      .eq('status', 'active')
      .single();

    if (existing) {
      console.log(`Already enrolled in sequence ${matchedSequence.id}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Already enrolled' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get first step delay
    const { data: firstStep } = await supabase
      .from('email_sequence_steps')
      .select('delay_minutes')
      .eq('sequence_id', matchedSequence.id)
      .eq('step_order', 1)
      .eq('is_active', true)
      .single();

    const delayMinutes = firstStep?.delay_minutes || 0;
    const nextSendAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    // Enroll in sequence
    const { data: enrollment, error: enrollError } = await supabase
      .from('email_sequence_enrollments')
      .insert({
        sequence_id: matchedSequence.id,
        organization_id,
        lead_id,
        email,
        current_step: 0,
        status: 'active',
        triggered_by,
        next_send_at: nextSendAt.toISOString(),
      })
      .select('id')
      .single();

    if (enrollError) throw enrollError;

    console.log(`✅ Enrolled ${email} in sequence, first send at ${nextSendAt.toISOString()}`);

    return new Response(
      JSON.stringify({
        success: true,
        enrollment_id: enrollment.id,
        next_send_at: nextSendAt.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Trigger error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
