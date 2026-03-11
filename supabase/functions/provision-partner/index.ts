import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const { email, name, phone, organizationId, role, virtualAccountId } = await req.json();

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    if (existingUser) {
      return new Response(JSON.stringify({ error: "User already exists", userId: existingUser.id }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Generate temp password
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let tempPassword = "";
    for (let i = 0; i < 10; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (authError) throw authError;
    const userId = authUser.user.id;

    // Create profile
    await supabaseAdmin.from('profiles').upsert({
      user_id: userId,
      email,
      full_name: name,
      whatsapp: phone,
      organization_id: organizationId,
      partner_virtual_account_id: virtualAccountId || null,
    });

    // Create org member
    await supabaseAdmin.from('organization_members').insert({
      user_id: userId,
      organization_id: organizationId,
      role: role || 'partner_coproducer',
    });

    // Link virtual account to user
    if (virtualAccountId) {
      await supabaseAdmin.from('virtual_accounts')
        .update({ user_id: userId })
        .eq('id', virtualAccountId);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      userId, 
      tempPassword,
      message: `User ${email} created with temp password`
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
