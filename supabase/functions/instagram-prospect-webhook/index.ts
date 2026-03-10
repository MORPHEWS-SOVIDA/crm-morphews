import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ORG_ID = "2d272c40-22e9-40e2-8cdc-3be142f61717";
const FUNNEL_STAGE_ID = "8e82e26e-901d-4818-9be5-e03ac3960ecd";
const DEFAULT_ASSIGNED_TO = "9382f568-91fa-42ce-a068-063f54788d4c";

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

    const { name, instagram, followers, observations, source } = await req.json();

    if (!name || !instagram) {
      return new Response(
        JSON.stringify({ error: "Campos 'name' e 'instagram' são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize instagram handle
    const normalizedInstagram = instagram.replace(/^@/, "").trim().toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for duplicate
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("organization_id", ORG_ID)
      .ilike("instagram", normalizedInstagram)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ status: "duplicate", message: "Lead já cadastrado", lead_id: existing.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert new lead
    const { data: newLead, error } = await supabase
      .from("leads")
      .insert({
        name: name.trim(),
        instagram: normalizedInstagram,
        followers: followers ? Number(followers) : 0,
        observations: observations || null,
        lead_source: source || "instagram_prospecting",
        organization_id: ORG_ID,
        funnel_stage_id: FUNNEL_STAGE_ID,
        stage: "prospect",
        assigned_to: DEFAULT_ASSIGNED_TO,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao criar lead", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: "created", lead_id: newLead.id }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("instagram-prospect-webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
