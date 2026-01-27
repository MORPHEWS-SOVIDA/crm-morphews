import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PartnerApplyPublicRequest = {
  public_link_id: string;
  name: string;
  email: string;
  whatsapp?: string | null;
  document?: string | null;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PartnerApplyPublicRequest = await req.json();

    if (!body?.public_link_id || !isUuid(body.public_link_id)) {
      return new Response(JSON.stringify({ success: false, error: "Link inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body?.name?.trim() || !body?.email?.trim()) {
      return new Response(JSON.stringify({ success: false, error: "Nome e e-mail são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Load public link config (server-side, to avoid tampering)
    const { data: link, error: linkError } = await supabase
      .from("partner_public_links")
      .select(
        "id, organization_id, is_active, expires_at, max_registrations, registrations_count, partner_type, commission_type, commission_value, responsible_for_refunds, responsible_for_chargebacks"
      )
      .eq("id", body.public_link_id)
      .maybeSingle();

    if (linkError) {
      console.error("partner-apply-public linkError:", linkError);
      return new Response(JSON.stringify({ success: false, error: "Erro ao validar link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!link || !link.is_active) {
      return new Response(JSON.stringify({ success: false, error: "Link não encontrado ou inativo" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (link.expires_at) {
      const expiresAt = new Date(link.expires_at);
      if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
        return new Response(JSON.stringify({ success: false, error: "Link expirado" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (
      typeof link.max_registrations === "number" &&
      typeof link.registrations_count === "number" &&
      link.registrations_count >= link.max_registrations
    ) {
      return new Response(JSON.stringify({ success: false, error: "Este link atingiu o limite de cadastros" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert application (no RETURNING, to avoid read RLS)
    const { error: insertError } = await supabase.from("partner_applications").insert({
      public_link_id: link.id,
      organization_id: link.organization_id,
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      whatsapp: body.whatsapp || null,
      document: body.document || null,
      partner_type: link.partner_type,
      commission_type: link.commission_type,
      commission_value: link.commission_value,
      responsible_for_refunds: link.responsible_for_refunds,
      responsible_for_chargebacks: link.responsible_for_chargebacks,
    });

    if (insertError) {
      console.error("partner-apply-public insertError:", insertError);
      return new Response(JSON.stringify({ success: false, error: "Erro ao salvar solicitação" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("partner-apply-public error:", err);
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
