import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ORG_ID = "2d272c40-22e9-40e2-8cdc-3be142f61717";

// Etapas válidas de follow-up
const FOLLOWUP_STAGE_IDS = [
  "b7415450-df58-4990-b0e9-aa5b0dc752b6", // Follow 01 ( Curtir + Comentar)
  "5133aeee-a17c-448f-8093-87c2156bbba8", // Follow-Up (Thiago)
  "1e298f43-e75c-4a63-b4b5-19c56d572193", // Follow-Up (João)
  "7dd5973f-9199-4c40-b95a-ba835bc39ad9", // Follow-Up (Estéfani)
  "06a53c02-2130-4114-ba23-2727880da0da", // Follow-Up (Antony)
  "16dfba97-568d-4ec6-90b8-5d466402268c", // Follow-Up (Clairton)
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const profileId = url.searchParams.get("profile_id") || "5673022d-9e55-4c77-93ed-b5eab07edbaf";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar leads do perfil que estão em etapas de follow-up
    const { data: activities, error: actError } = await supabase
      .from("social_selling_activities")
      .select("lead_id")
      .eq("profile_id", profileId)
      .eq("organization_id", ORG_ID);

    if (actError) throw new Error(actError.message);

    const leadIds = [...new Set((activities || []).map((a: any) => a.lead_id))];

    if (leadIds.length === 0) {
      return new Response(
        JSON.stringify({ leads: [], total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar leads que estão nas etapas de follow-up
    const { data: leads, error: leadError } = await supabase
      .from("leads")
      .select("id, name, instagram, funnel_stage_id, observations")
      .eq("organization_id", ORG_ID)
      .in("id", leadIds)
      .in("funnel_stage_id", FOLLOWUP_STAGE_IDS);

    if (leadError) throw new Error(leadError.message);

    // Buscar nomes das etapas
    const { data: stages } = await supabase
      .from("organization_funnel_stages")
      .select("id, name")
      .in("id", FOLLOWUP_STAGE_IDS);

    const stageMap = Object.fromEntries((stages || []).map((s: any) => [s.id, s.name]));

    const result = (leads || [])
      .filter((l: any) => l.instagram) // só leads com instagram
      .map((l: any) => ({
        id: l.id,
        name: l.name,
        instagram: l.instagram,
        stage: stageMap[l.funnel_stage_id] || "Desconhecida",
      }));

    return new Response(
      JSON.stringify({ leads: result, total: result.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("export-followup-leads error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
