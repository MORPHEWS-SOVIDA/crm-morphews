import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function normalizeWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, '');
  if (!clean) return null;
  if (!clean.startsWith('55')) {
    clean = '55' + clean;
  }
  if (clean.length === 12 && clean.startsWith('55')) {
    clean = clean.slice(0, 4) + '9' + clean.slice(4);
  }
  return clean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: require admin secret (simple check for internal use only)
    const adminSecret = req.headers.get("x-admin-secret");
    
    // Allow specific admin secret for manual provisioning
    if (adminSecret !== "morphews-admin-2026") {
      console.log("Unauthorized attempt with secret:", adminSecret);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, name, whatsapp, planId, stripeCustomerId, stripeSubscriptionId } = await req.json();

    console.log("Manual user provision:", { email, name, planId });

    if (!email || !planId) {
      return new Response(JSON.stringify({ error: "Missing email or planId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get plan details
    const { data: plan } = await supabaseAdmin
      .from("subscription_plans")
      .select("name")
      .eq("id", planId)
      .single();

    const planName = plan?.name || "Morphews CRM";

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;
    let tempPassword: string | null = null;

    if (existingUser) {
      console.log("User already exists:", existingUser.id);
      userId = existingUser.id;
    } else {
      tempPassword = generatePassword();
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: name?.split(" ")[0] || "Usuário",
          last_name: name?.split(" ").slice(1).join(" ") || "",
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        throw createError;
      }

      userId = newUser.user.id;
      console.log("New user created:", userId);

      // Create profile
      const firstName = name?.split(" ")[0] || "Usuário";
      const lastName = name?.split(" ").slice(1).join(" ") || "Novo";

      await supabaseAdmin.from("profiles").upsert({
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        whatsapp: normalizeWhatsApp(whatsapp),
        email,
      }, { onConflict: "user_id" });

      // Record temp password reset
      await supabaseAdmin.from("temp_password_resets").insert({
        user_id: userId,
        email,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // Assign user role
      await supabaseAdmin.from("user_roles").upsert({
        user_id: userId,
        role: "user",
      }, { onConflict: "user_id" });
    }

    // Check if user has an organization
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    let organizationId = profile?.organization_id;

    // If no organization, create one
    if (!organizationId) {
      const orgName = name ? `${name}` : `Organização ${userId.slice(0, 8)}`;
      const orgSlug = orgName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `org-${userId.slice(0, 8)}`;

      const { data: newOrg, error: orgError } = await supabaseAdmin
        .from("organizations")
        .insert({
          name: orgName,
          slug: orgSlug,
          owner_name: name || null,
          owner_email: email,
          phone: whatsapp || null,
        })
        .select()
        .single();

      if (orgError) {
        console.error("Error creating organization:", orgError);
        throw orgError;
      }

      organizationId = newOrg.id;
      console.log("Organization created:", organizationId);

      // Add user as owner
      await supabaseAdmin.from("organization_members").insert({
        organization_id: organizationId,
        user_id: userId,
        role: "owner",
      });

      // Update profile
      await supabaseAdmin
        .from("profiles")
        .update({ organization_id: organizationId })
        .eq("user_id", userId);
    }

    // Create subscription
    const { error: subError } = await supabaseAdmin
      .from("subscriptions")
      .upsert({
        organization_id: organizationId,
        plan_id: planId,
        stripe_customer_id: stripeCustomerId || null,
        stripe_subscription_id: stripeSubscriptionId || null,
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }, {
        onConflict: "organization_id",
      });

    if (subError) {
      console.error("Error creating subscription:", subError);
    }

    // Update interested_leads status
    await supabaseAdmin
      .from("interested_leads")
      .update({ status: "converted", converted_at: new Date().toISOString() })
      .eq("email", email);

    console.log("User provisioned successfully");

    // Send welcome email if new user
    if (tempPassword) {
      try {
        const internalSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(0, 32);
        
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            "x-internal-secret": internalSecret || "",
          },
          body: JSON.stringify({
            email,
            name: name || "Usuário",
            password: tempPassword,
            planName,
          }),
        });
        console.log("Welcome email sent");
      } catch (emailError) {
        console.error("Error sending welcome email:", emailError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      userId, 
      organizationId,
      tempPassword: tempPassword || "(user already existed)",
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
