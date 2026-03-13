import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const internalSecret = Deno.env.get("INTERNAL_AUTH_SECRET");
    const providedSecret = req.headers.get("x-internal-secret");
    
    if (!internalSecret || providedSecret !== internalSecret) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, name, whatsapp, virtual_account_id, organization_id, product_ids } = await req.json();

    // Generate temp password
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let tempPassword = "";
    for (let i = 0; i < 10; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: name?.split(" ")[0] || "Usuário",
        last_name: name?.split(" ").slice(1).join(" ") || "",
      },
    });

    if (createError) throw createError;
    const userId = newUser.user.id;
    console.log("User created:", userId);

    // Normalize whatsapp
    let cleanPhone = whatsapp?.replace(/\D/g, '') || null;
    if (cleanPhone && !cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

    // Create profile
    await supabaseAdmin.from("profiles").upsert({
      user_id: userId,
      first_name: name?.split(" ")[0] || "Usuário",
      last_name: name?.split(" ").slice(1).join(" ") || "",
      whatsapp: cleanPhone,
      email,
      organization_id,
    }, { onConflict: "user_id" });

    // Assign user role
    await supabaseAdmin.from("user_roles").upsert({
      user_id: userId,
      role: "user",
    }, { onConflict: "user_id" });

    // Link virtual account to user
    await supabaseAdmin
      .from("virtual_accounts")
      .update({ user_id: userId })
      .eq("id", virtual_account_id);

    console.log("Virtual account linked");

    // Create partner_associations for each product
    if (product_ids?.length) {
      const associations = product_ids.map((productId: string) => ({
        virtual_account_id,
        organization_id,
        partner_type: "coproducer",
        product_id: productId,
        commission_type: "fixed",
        commission_value: 0, // actual commission is in coproducers table
        is_active: true,
      }));

      const { error: assocError } = await supabaseAdmin
        .from("partner_associations")
        .insert(associations);

      if (assocError) {
        console.error("Error creating partner_associations:", assocError);
      } else {
        console.log(`Created ${associations.length} partner associations`);
      }
    }

    // Record temp password reset
    await supabaseAdmin.from("temp_password_resets").insert({
      user_id: userId,
      email,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return new Response(JSON.stringify({
      success: true,
      userId,
      tempPassword,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
