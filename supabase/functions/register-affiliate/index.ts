import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { tenantSlug, storefrontSlug, action, name, email, phone, how_promote } = body;

    if (!tenantSlug || !storefrontSlug) {
      return new Response(
        JSON.stringify({ error: "Tenant e loja são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find tenant organization
    const { data: tenant } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", tenantSlug)
      .maybeSingle();

    if (!tenant) {
      return new Response(
        JSON.stringify({ error: "Organização não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find storefront by slug within the tenant
    const { data: storefront, error: sfError } = await supabaseAdmin
      .from("tenant_storefronts")
      .select("id, name, organization_id")
      .eq("slug", storefrontSlug)
      .eq("organization_id", tenant.id)
      .eq("is_active", true)
      .maybeSingle();

    if (sfError || !storefront) {
      return new Response(
        JSON.stringify({ error: "Loja não encontrada nesta organização" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If just requesting storefront info, return it
    if (action === 'get-storefront-info') {
      return new Response(
        JSON.stringify({
          storefront: {
            id: storefront.id,
            name: storefront.name,
            organization_id: storefront.organization_id,
            logo_url: null,
            external_site_url: null,
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For registration, require name and email
    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: "Nome e email são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if affiliate already exists for this org+email
    const { data: existing } = await supabaseAdmin
      .from("organization_affiliates")
      .select("id")
      .eq("organization_id", storefront.organization_id)
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: "Cadastro já existente. Aguarde aprovação." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth account (auto-confirm disabled, user verifies email)
    const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: tempPassword,
      email_confirm: false,
      user_metadata: { full_name: name },
    });

    // If user already exists in auth, that's fine — get their id
    let userId: string | null = authData?.user?.id ?? null;
    if (authError) {
      if (authError.message?.includes("already been registered") || authError.message?.includes("already exists")) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const found = existingUsers?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase().trim()
        );
        userId = found?.id ?? null;
      } else {
        console.error("Auth error:", authError);
        // Continue without user_id — admin can link later
      }
    }

    // Generate affiliate code
    const tempCode =
      "AFF" + crypto.randomUUID().replace(/-/g, "").slice(0, 7).toUpperCase();

    // Insert affiliate record (inactive, pending approval)
    const { error: insertError } = await supabaseAdmin
      .from("organization_affiliates")
      .insert({
        organization_id: storefront.organization_id,
        email: email.toLowerCase().trim(),
        name: name.trim(),
        phone: phone?.trim() || null,
        is_active: false,
        user_id: userId,
        affiliate_code: tempCode,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(
          JSON.stringify({ success: true, message: "Cadastro já existente." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao cadastrar afiliado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Cadastro enviado! Aguarde aprovação." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
