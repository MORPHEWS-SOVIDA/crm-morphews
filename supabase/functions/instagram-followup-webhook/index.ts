import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ORG_ID = "2d272c40-22e9-40e2-8cdc-3be142f61717";
const FOLLOWUP_STAGE_ID = "8c48bd92-42e3-4f9a-b885-74e7b1483846";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { instagram, observations } = await req.json();

    if (!instagram) {
      return new Response(
        JSON.stringify({ error: "Campo 'instagram' é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedInstagram = instagram.replace(/^@/, "").trim().toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: lead, error: findError } = await supabase
      .from("leads")
      .select("id, name, funnel_stage_id")
      .eq("organization_id", ORG_ID)
      .ilike("instagram", normalizedInstagram)
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error("Find error:", findError);
      throw new Error(findError.message);
    }

    if (!lead) {
      return new Response(
        JSON.stringify({ status: "not_found", message: `Lead com @${normalizedInstagram} não encontrado` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updateData: Record<string, unknown> = {
      funnel_stage_id: FOLLOWUP_STAGE_ID,
    };

    if (observations) {
      const { data: currentLead } = await supabase
        .from("leads")
        .select("observations")
        .eq("id", lead.id)
        .single();

      const existingObs = currentLead?.observations || "";
      const timestamp = new Date().toISOString().split("T")[0];
      updateData.observations = existingObs
        ? `${existingObs}\n[${timestamp}] Follow-up 01 (Curtir+Comentar): ${observations}`
        : `[${timestamp}] Follow-up 01 (Curtir+Comentar): ${observations}`;
    }

    const { error: updateError } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", lead.id);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(updateError.message);
    }

    console.log(`[instagram-followup-webhook] Lead ${lead.name} (@${normalizedInstagram}) moved to "FEITO Follow 01"`);

    return new Response(
      JSON.stringify({
        status: "moved",
        lead_id: lead.id,
        lead_name: lead.name,
        new_stage: "FEITO Follow 01 (Curtir + Comentar) MINION",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("instagram-followup-webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
