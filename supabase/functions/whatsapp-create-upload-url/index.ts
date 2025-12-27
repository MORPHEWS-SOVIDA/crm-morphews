import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/**
 * Edge Function para criar signed upload URL para mídia do WhatsApp
 * 
 * Isso resolve o problema de base64 estourando o limite de payload:
 * 1. Frontend chama esta função para obter URL de upload
 * 2. Frontend faz upload direto para o storage via PUT
 * 3. Frontend chama whatsapp-send-message com mediaStoragePath (não base64)
 * 
 * Input JSON: { organizationId, conversationId, mimeType, kind }
 * Output JSON: { success: true, path: objectPath, signedUrl }
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().split('-')[0];
  console.log(`\n========== [${requestId}] WHATSAPP CREATE UPLOAD URL ==========`);

  try {
    // Validate auth token
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error(`[${requestId}] ❌ No authorization header`);
      return new Response(
        JSON.stringify({ success: false, error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, authHeader.replace("Bearer ", ""));

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error(`[${requestId}] ❌ Auth error:`, userError);
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${requestId}] User authenticated:`, user.id);

    const body = await req.json();
    const { organizationId, conversationId, mimeType, kind } = body;

    console.log(`[${requestId}] Request params:`, {
      organization_id: organizationId,
      conversation_id: conversationId,
      mime_type: mimeType,
      kind: kind,
    });

    // Validate required params
    if (!organizationId) {
      return new Response(
        JSON.stringify({ success: false, error: "organizationId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!conversationId) {
      return new Response(
        JSON.stringify({ success: false, error: "conversationId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!mimeType) {
      return new Response(
        JSON.stringify({ success: false, error: "mimeType é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!kind || !["image", "audio", "document", "video"].includes(kind)) {
      return new Response(
        JSON.stringify({ success: false, error: "kind deve ser image, audio, document ou video" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user belongs to organization
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .single();

    if (membershipError || !membership) {
      console.error(`[${requestId}] ❌ User not member of org:`, membershipError);
      return new Response(
        JSON.stringify({ success: false, error: "Sem permissão para esta organização" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate file path
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const fileId = crypto.randomUUID();
    
    // Extension from mimeType
    let ext = "bin";
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
    else if (mimeType.includes("png")) ext = "png";
    else if (mimeType.includes("webp")) ext = "webp";
    else if (mimeType.includes("gif")) ext = "gif";
    else if (mimeType.includes("mp3") || mimeType.includes("mpeg")) ext = "mp3";
    else if (mimeType.includes("ogg")) ext = "ogg";
    else if (mimeType.includes("wav")) ext = "wav";
    else if (mimeType.includes("m4a")) ext = "m4a";
    else if (mimeType.includes("mp4")) ext = "mp4";
    else if (mimeType.includes("webm")) ext = "webm";
    else if (mimeType.includes("pdf")) ext = "pdf";
    else if (mimeType.includes("doc")) ext = "doc";

    // Path structure: orgs/{organizationId}/whatsapp/{conversationId}/{yyyy}/{mm}/{uuid}.{ext}
    const objectPath = `orgs/${organizationId}/whatsapp/${conversationId}/${year}/${month}/${fileId}.${ext}`;
    const bucket = "whatsapp-media";

    console.log(`[${requestId}] Creating signed upload URL:`, {
      bucket,
      path: objectPath,
      content_type: mimeType,
    });

    // Create signed upload URL (expires in 300 seconds = 5 minutes)
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from(bucket)
      .createSignedUploadUrl(objectPath);

    if (uploadError) {
      console.error(`[${requestId}] ❌ Failed to create upload URL:`, uploadError);
      return new Response(
        JSON.stringify({ success: false, error: `Falha ao criar URL de upload: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${requestId}] ✅ Signed upload URL created:`, {
      path: objectPath,
      url_preview: uploadData.signedUrl.substring(0, 80) + "...",
    });

    return new Response(
      JSON.stringify({
        success: true,
        path: objectPath,
        signedUrl: uploadData.signedUrl,
        token: uploadData.token,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error(`[${requestId}] ❌ Unexpected error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
