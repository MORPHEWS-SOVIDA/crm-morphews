// Admin impersonate user function - v2
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get the authorization header to verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract and validate Bearer token
    const jwtToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwtToken) {
      return new Response(
        JSON.stringify({ error: "Malformed authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with anon key for JWT validation
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    // Validate token claims (signing-keys compatible)
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(jwtToken);
    const userId = claimsData?.claims?.sub;
    const userEmail = claimsData?.claims?.email;

    if (claimsError || !userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: claimsError?.message || "Invalid token claims" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is super admin
    const { data: isAdmin, error: adminError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (adminError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Only super admins can impersonate users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const { targetUserId, targetEmail } = await req.json();
    
    if (!targetUserId && !targetEmail) {
      return new Response(
        JSON.stringify({ error: "Missing targetUserId or targetEmail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get target user email if only ID provided
    let email = targetEmail;
    if (!email && targetUserId) {
      const { data: targetUser, error: targetError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (targetError || !targetUser?.user) {
        return new Response(
          JSON.stringify({ error: "Target user not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      email = targetUser.user.email;
    }

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Could not determine target user email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a magic link for the target user
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email,
    });

    if (linkError || !linkData) {
      console.error("Error generating magic link:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to generate impersonation link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the token from the link
    // The link format is: https://project.supabase.co/auth/v1/verify?token=xxx&type=magiclink
    const url = new URL(linkData.properties.action_link);
    const token = url.searchParams.get("token");
    const tokenHash = linkData.properties.hashed_token;

    // Get target user info for the banner
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("user_id", targetUserId || linkData.user.id)
      .maybeSingle();

    console.log(`[admin-impersonate] Admin ${userEmail || userId} impersonating ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        email: email,
        token: token,
        tokenHash: tokenHash,
        targetUser: {
          id: targetUserId || linkData.user.id,
          email: email,
          name: targetProfile 
            ? `${targetProfile.first_name || ''} ${targetProfile.last_name || ''}`.trim() 
            : email,
        },
        adminUser: {
          id: String(userId),
          email: typeof userEmail === "string" ? userEmail : "",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Impersonation error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
