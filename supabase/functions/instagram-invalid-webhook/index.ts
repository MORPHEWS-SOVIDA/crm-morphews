import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ORG_ID = "2d272c40-22e9-40e2-8cdc-3be142f61717";
const REVIEW_STAGE_ID = "c1e6780c-717e-419d-b13e-e937d19b608a";

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

    const { instagram, observations } = await req.json().catch(() => ({}));

    if (!instagram || typeof instagram !== "string" || !instagram.trim()) {
      return new Response(
        JSON.stringify({ error: "instagram required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedInstagram = instagram.replace(/^@/, "").trim().toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find lead scoped to MARCA PRÓPRIA org only (defense in depth)
    const { data: lead, error: findError } = await supabase
      .from("leads")
      .select("id, name, funnel_stage_id, organization_id")
      .eq("organization_id", ORG_ID)
      .ilike("instagram", normalizedInstagram)
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error("Find error:", findError);
      return new Response(
        JSON.stringify({ status: "error", error: findError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Not found OR belongs to another org → treat as not_found
    if (!lead || lead.organization_id !== ORG_ID) {
      return new Response(
        JSON.stringify({ status: "not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updateData: Record<string, unknown> = {
      funnel_stage_id: REVIEW_STAGE_ID,
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
        ? `${existingObs}\n[${timestamp}] Revisar Username (typo provável): ${observations}`
        : `[${timestamp}] Revisar Username (typo provável): ${observations}`;
    }

    const { error: updateError } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", lead.id)
      .eq("organization_id", ORG_ID);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ status: "error", error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[instagram-invalid-webhook] Lead ${lead.name} (@${normalizedInstagram}) moved to "Revisar Username"`);

    return new Response(
      JSON.stringify({ status: "moved" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("instagram-invalid-webhook error:", e);
    return new Response(
      JSON.stringify({ status: "error", error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
