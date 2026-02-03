import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const INTERNAL_AUTH_SECRET = Deno.env.get("INTERNAL_AUTH_SECRET");

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    // Check authorization - either internal secret OR master admin JWT
    const internalSecret = req.headers.get("x-internal-secret");
    const authHeader = req.headers.get("authorization");
    
    let isAuthorized = false;
    
    // Option 1: Internal secret
    if (INTERNAL_AUTH_SECRET && internalSecret === INTERNAL_AUTH_SECRET) {
      isAuthorized = true;
      console.log("Authorized via internal secret");
    }
    // Option 2: Master admin JWT
    else if (authHeader?.startsWith("Bearer ")) {
      const supabaseAnon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { authorization: authHeader } },
      });
      
      const { data: userRes, error: userErr } = await supabaseAnon.auth.getUser();
      if (!userErr && userRes?.user) {
        const { data: isMasterAdmin } = await supabaseAdmin.rpc("is_master_admin", {
          _user_id: userRes.user.id,
        });
        if (isMasterAdmin) {
          isAuthorized = true;
          console.log("Authorized as master admin:", userRes.user.email);
        }
      }
    }
    
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized - requires internal secret or master admin" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      organizationId,
      customerName,
      customerEmail,
      customerWhatsapp,
    } = await req.json();

    console.log("Demo User Provision:", { organizationId, customerEmail, customerName });

    if (!organizationId || !customerEmail || !customerName) {
      return new Response(JSON.stringify({ 
        error: "Dados incompletos: organizationId, customerEmail, customerName são obrigatórios" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === customerEmail);

    if (existingUser) {
      return new Response(JSON.stringify({ 
        error: "Usuário já existe com este email" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user
    const tempPassword = generatePassword();
    const firstName = customerName?.split(" ")[0] || "Usuário";
    const lastName = customerName?.split(" ").slice(1).join(" ") || "";

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: customerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      throw createError;
    }

    const userId = newUser.user.id;
    console.log("New user created:", userId);

    // Create/update profile with organization_id
    await supabaseAdmin.from("profiles").upsert({
      user_id: userId,
      organization_id: organizationId,
      first_name: firstName,
      last_name: lastName,
      whatsapp: normalizeWhatsApp(customerWhatsapp),
      email: customerEmail,
    }, { onConflict: "user_id" });

    // Record temp password reset
    await supabaseAdmin.from("temp_password_resets").insert({
      user_id: userId,
      email: customerEmail,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Assign user role
    await supabaseAdmin.from("user_roles").upsert({
      user_id: userId,
      role: "user",
    }, { onConflict: "user_id" });

    // Add user to organization members as owner
    await supabaseAdmin.from("organization_members").insert({
      organization_id: organizationId,
      user_id: userId,
      role: "owner",
    });

    // Update organization owner info
    await supabaseAdmin
      .from("organizations")
      .update({
        owner_name: customerName,
        owner_email: customerEmail,
        phone: customerWhatsapp || null,
      })
      .eq("id", organizationId);

    console.log("Demo user provisioned successfully");

    return new Response(JSON.stringify({
      success: true,
      userId,
      organizationId,
      tempPassword,
      email: customerEmail,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Demo User Provision Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
