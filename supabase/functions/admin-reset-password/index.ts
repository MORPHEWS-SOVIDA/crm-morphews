import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const INTERNAL_AUTH_SECRET = Deno.env.get("INTERNAL_AUTH_SECRET");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const internalSecret = req.headers.get("x-internal-secret");
    const authHeader = req.headers.get("authorization");

    const isAuthorized =
      (INTERNAL_AUTH_SECRET && internalSecret === INTERNAL_AUTH_SECRET) ||
      (SERVICE_ROLE_KEY && authHeader === `Bearer ${SERVICE_ROLE_KEY}`);

    if (!isAuthorized) {
      // Also check if caller is master admin
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      let isMaster = false;
      if (authHeader?.startsWith("Bearer ")) {
        const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
          global: { headers: { authorization: authHeader } },
        });
        const { data: userRes } = await supabaseAnon.auth.getUser();
        if (userRes?.user) {
          const supabaseAdmin = createClient(supabaseUrl, SERVICE_ROLE_KEY!);
          const { data } = await supabaseAdmin.rpc("is_master_admin", { _user_id: userRes.user.id });
          if (data) isMaster = true;
        }
      }
      if (!isMaster) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { userId, password } = await req.json();

    if (!userId || !password) {
      return new Response(JSON.stringify({ error: "userId and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Password updated" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
