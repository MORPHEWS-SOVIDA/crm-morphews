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

// Tamanho seguro para .in() — evita estourar URL no PostgREST
const CHUNK_SIZE = 200;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let profileId = "5673022d-9e55-4c77-93ed-b5eab07edbaf";
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.profile_id) profileId = body.profile_id;
    } else {
      const url = new URL(req.url);
      if (url.searchParams.get("profile_id")) profileId = url.searchParams.get("profile_id")!;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar TODOS os lead_ids do perfil em paginação (evita limite de 1000 do PostgREST)
    const leadIdSet = new Set<string>();
    const PAGE_SIZE = 1000;
    let page = 0;
    while (true) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("social_selling_activities")
        .select("lead_id")
        .eq("profile_id", profileId)
        .eq("organization_id", ORG_ID)
        .range(from, to);

      if (error) throw new Error(`activities: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const row of data) {
        if (row.lead_id) leadIdSet.add(row.lead_id);
      }
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    const leadIds = Array.from(leadIdSet);
    console.log(`profile=${profileId} total lead_ids=${leadIds.length}`);

    if (leadIds.length === 0) {
      return new Response(
        JSON.stringify({ leads: [], total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar leads em chunks para evitar URL muito longa no .in()
    const allLeads: any[] = [];
    for (const ids of chunk(leadIds, CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, instagram, funnel_stage_id, observations")
        .eq("organization_id", ORG_ID)
        .in("id", ids)
        .in("funnel_stage_id", FOLLOWUP_STAGE_IDS);

      if (error) throw new Error(`leads chunk: ${error.message}`);
      if (data) allLeads.push(...data);
    }

    console.log(`leads in followup stages=${allLeads.length}`);

    // Buscar nomes das etapas
    const { data: stages } = await supabase
      .from("organization_funnel_stages")
      .select("id, name")
      .in("id", FOLLOWUP_STAGE_IDS);

    const stageMap = Object.fromEntries((stages || []).map((s: any) => [s.id, s.name]));

    const result = allLeads
      .filter((l: any) => l.instagram)
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
