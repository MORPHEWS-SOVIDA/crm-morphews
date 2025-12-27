import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_MEDIA_TOKEN_SECRET = Deno.env.get("WHATSAPP_MEDIA_TOKEN_SECRET") ?? "";
const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "";

const WASENDER_BASE = "https://www.wasenderapi.com";

// ============================================================================
// HMAC TOKEN GENERATION (for secure media proxy URLs)
// ============================================================================

async function createHmacSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  
  // Convert to hex string for URL safety
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a secure HMAC-signed token for media proxy access
 * Token expires in 5 minutes (300 seconds)
 */
async function generateMediaProxyUrl(
  storagePath: string,
  expiresInSeconds = 300
): Promise<string> {
  if (!WHATSAPP_MEDIA_TOKEN_SECRET) {
    throw new Error("WHATSAPP_MEDIA_TOKEN_SECRET não configurado - impossível gerar URL segura");
  }

  // Prefer calling the public backend function URL directly (works both for browser and WhatsApp recipients).
  // Fallback to PUBLIC_APP_URL only if SUPABASE_URL is missing.
  if (!SUPABASE_URL && !PUBLIC_APP_URL) {
    throw new Error("SUPABASE_URL/PUBLIC_APP_URL não configurado - impossível gerar URL do proxy");
  }

  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;

  // Create signature: HMAC-SHA256(path + exp, secret)
  const dataToSign = `${storagePath}:${exp}`;
  const token = await createHmacSignature(dataToSign, WHATSAPP_MEDIA_TOKEN_SECRET);

  const supabaseBase = SUPABASE_URL ? SUPABASE_URL.replace(/\/$/, "") : "";
  const publicBase = PUBLIC_APP_URL ? PUBLIC_APP_URL.replace(/\/$/, "") : "";

  // Primary: public function endpoint
  const proxyBaseUrl = supabaseBase
    ? `${supabaseBase}/functions/v1/whatsapp-media-proxy`
    : `${publicBase}/api/whatsapp/media`;

  // Build proxy URL with querystring
  const proxyUrl = `${proxyBaseUrl}?path=${encodeURIComponent(storagePath)}&exp=${exp}&token=${token}`;
  
  console.log("✅ Generated secure proxy URL:", { 
    path: storagePath, 
    expiresAt: new Date(exp * 1000).toISOString(),
    proxyUrl: proxyUrl.substring(0, 100) + "..." 
  });
  
  return proxyUrl;
}

// ============================================================================
// MEDIA UTILITIES
// ============================================================================

function isDataUrl(v: string) {
  return typeof v === "string" && v.startsWith("data:");
}

function parseDataUrl(dataUrl: string) {
  const m = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!m) throw new Error("mediaUrl inválida (esperado data URL base64)");
  return { mime: m[1], base64: m[2] };
}

function extFromMime(mime: string): string {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("mp3") || mime.includes("mpeg")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("m4a")) return "m4a";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("doc")) return "doc";
  return "bin";
}

/**
 * Upload media to PRIVATE storage and return secure proxy URL
 * Path structure: orgs/{organization_id}/instances/{instance_id}/{conversation_id}/{timestamp}_{random}.{ext}
 * NEVER uses getPublicUrl() - always proxy with HMAC token
 */
async function uploadMediaAndGetProxyUrl(
  supabaseAdmin: any,
  organizationId: string,
  instanceId: string,
  conversationId: string,
  base64: string,
  mime: string
): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const ext = extFromMime(mime);
  const timestamp = Date.now();
  const random = crypto.randomUUID().split('-')[0]; // Short random string
  
  // Structured path for organization/tenant isolation
  const storagePath = `orgs/${organizationId}/instances/${instanceId}/${conversationId}/${timestamp}_${random}.${ext}`;
  const bucket = "whatsapp-media";

  console.log("📤 Uploading media to private storage:", {
    organization_id: organizationId,
    instance_id: instanceId,
    conversation_id: conversationId,
    media_path: storagePath,
    mime_type: mime,
    size_bytes: bytes.length
  });

  // Upload to PRIVATE bucket
  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, bytes, {
      contentType: mime,
      upsert: true,
    });

  if (uploadError) {
    console.error("❌ Storage upload failed:", uploadError);
    throw new Error(`Falha ao subir mídia no storage: ${uploadError.message}`);
  }

  console.log("✅ Media uploaded successfully:", storagePath);

  // Generate secure proxy URL (NEVER use getPublicUrl)
  const proxyUrl = await generateMediaProxyUrl(storagePath);
  
  return proxyUrl;
}

// ============================================================================
// WASENDER API
// ============================================================================

async function wasenderRequest(apiKey: string, path: string, payload: any) {
  console.log("📡 Wasender request:", { 
    path, 
    to: payload.to, 
    hasText: !!payload.text,
    hasImageUrl: !!payload.imageUrl,
    hasAudioUrl: !!payload.audioUrl,
    hasVideoUrl: !!payload.videoUrl,
    hasDocumentUrl: !!payload.documentUrl
  });
  
  const res = await fetch(`${WASENDER_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  console.log("📡 Wasender response:", { 
    path, 
    status: res.status, 
    ok: res.ok, 
    success: json?.success,
    error: json?.error || json?.message,
    data: json?.data
  });

  return { ok: res.ok, status: res.status, json };
}

/**
 * Send message via Wasender API following their official documentation
 * All message types use POST /api/send-message with specific parameters
 * 
 * Documentation: https://wasenderapi.com/api-docs/messages/
 * 
 * Parameters:
 * - to: Recipient phone number in E.164 format, Group JID (xxx@g.us), or Community Channel JID
 * - text: Text content (required for text messages, optional caption for media)
 * - imageUrl: URL of image (JPEG, PNG) - max 5MB
 * - audioUrl: URL of audio (AAC, MP3, OGG, AMR) - max 16MB - sent as voice note
 * - videoUrl: URL of video (MP4) - max 16MB
 * - documentUrl: URL of document (PDF, etc) - max 16MB
 */
async function sendWasenderMessage(params: {
  apiKey: string;
  to: string;
  type: "text" | "image" | "audio" | "document" | "video";
  text?: string;
  mediaUrl?: string;
}) {
  const { apiKey, to, type, text, mediaUrl } = params;

  // Build payload following Wasender official documentation
  // All types use the same endpoint: POST /api/send-message
  const payload: Record<string, any> = { to };

  switch (type) {
    case "text":
      // Text message: requires "text" field
      payload.text = text ?? "";
      break;
      
    case "image":
      // Image message: requires "imageUrl", optional "text" as caption
      payload.imageUrl = mediaUrl;
      if (text) payload.text = text;
      break;
      
    case "audio":
      // Audio message: requires "audioUrl" (sent as voice note)
      payload.audioUrl = mediaUrl;
      break;
      
    case "video":
      // Video message: requires "videoUrl", optional "text" as caption  
      payload.videoUrl = mediaUrl;
      if (text) payload.text = text;
      break;
      
    case "document":
      // Document message: requires "documentUrl", optional "text" as caption
      payload.documentUrl = mediaUrl;
      if (text) payload.text = text;
      break;
  }

  console.log("📤 Sending to Wasender:", {
    type,
    to: to.substring(0, 20) + "...",
    hasText: !!payload.text,
    hasMedia: !!mediaUrl,
    payload_keys: Object.keys(payload)
  });

  const result = await wasenderRequest(apiKey, "/api/send-message", payload);
  
  if (result.ok && result.json?.success) {
    // Extract message ID from response
    const providerMessageId = 
      result.json?.data?.msgId?.toString() || 
      result.json?.data?.id || 
      result.json?.data?.messageId || 
      result.json?.data?.key?.id || 
      null;
      
    console.log("✅ Wasender success:", { providerMessageId });
    return { success: true, providerMessageId, raw: result.json };
  }

  // Handle error
  const errorMsg = result.json?.message || result.json?.error || result.json?.raw || `HTTP ${result.status}`;
  console.error("❌ Wasender error:", errorMsg);
  return { success: false, providerMessageId: null, error: errorMsg };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().split('-')[0];
  console.log(`\n========== [${requestId}] WHATSAPP SEND MESSAGE ==========`);

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const {
      organizationId,
      instanceId,
      conversationId,
      chatId,
      phone,
      content,
      messageType,
      mediaUrl,
      mediaCaption,
      mediaStoragePath, // NOVO: path no storage (evita base64 grande)
    } = body;

    console.log(`[${requestId}] Request params:`, {
      organization_id: organizationId,
      instance_id: instanceId,
      conversation_id: conversationId,
      message_type: messageType || "text",
      has_media: !!mediaUrl,
      chat_id: chatId ? chatId.substring(0, 20) + "..." : null,
    });

    if (!organizationId) {
      console.error(`[${requestId}] ❌ Missing organizationId`);
      return new Response(
        JSON.stringify({ success: false, error: "organizationId é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!instanceId) {
      console.error(`[${requestId}] ❌ Missing instanceId`);
      return new Response(
        JSON.stringify({ success: false, error: "instanceId é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!conversationId) {
      console.error(`[${requestId}] ❌ Missing conversationId`);
      return new Response(
        JSON.stringify({ success: false, error: "conversationId é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load instance
    const { data: instance, error: instErr } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instanceId)
      .single();

    if (instErr || !instance) {
      console.error(`[${requestId}] ❌ Instance not found:`, instanceId, instErr);
      return new Response(
        JSON.stringify({ success: false, error: "Instância não encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!instance.wasender_api_key) {
      console.error(`[${requestId}] ❌ Instance not configured (no API key)`);
      return new Response(
        JSON.stringify({ success: false, error: "Instância Wasender não configurada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // NÃO bloquear envio por is_connected (pode estar desatualizado). Se estiver desconectado,
    // o Wasender vai retornar erro e a UI mostrará o motivo real.
    if (!instance.is_connected) {
      console.warn(`[${requestId}] ⚠️ Instance marked as not connected in DB (continuing anyway)`, {
        instance_id: instanceId,
      });
    }

    // Destination: prefer chatId (stable JID), fallback to phone
    const toRaw = (chatId || phone || "").toString().trim();

    // Wasender docs use E.164 with "+" for individual numbers; keep JIDs as-is (e.g. @g.us)
    const to = toRaw.includes("@")
      ? toRaw
      : (toRaw.startsWith("+") ? toRaw : `+${toRaw.replace(/[^0-9]/g, "")}`);

    if (!to || to === "+") {
      console.error(`[${requestId}] ❌ No destination (chatId/phone)`);
      return new Response(
        JSON.stringify({ success: false, error: "Destino inválido (chatId/phone vazio)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process media if present
    let finalMediaUrl: string | null = null;
    let finalType: "text" | "image" | "audio" | "document" | "video" =
      (messageType as any) || "text";
    let text = (content ?? "").toString();

    // NOVO MODO: mediaStoragePath (arquivo já no storage, evita base64 grande)
    if (mediaStoragePath && typeof mediaStoragePath === "string") {
      console.log(`[${requestId}] 📎 Processing media from storage path:`, mediaStoragePath);

      // Validar que o path pertence à org (segurança contra cross-tenant)
      if (!mediaStoragePath.startsWith(`orgs/${organizationId}/`)) {
        console.error(`[${requestId}] ❌ Invalid storage path (cross-tenant attempt)`);
        return new Response(
          JSON.stringify({ success: false, error: "Caminho de mídia inválido" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Gerar URL segura via proxy
      finalMediaUrl = await generateMediaProxyUrl(mediaStoragePath);
      console.log(`[${requestId}] ✅ Media ready for sending via storage path`);
    } else if (mediaUrl && isDataUrl(mediaUrl)) {
      console.log(`[${requestId}] 📎 Processing media attachment (data URL - legacy mode)`);

      const parsed = parseDataUrl(mediaUrl);

      // Upload to PRIVATE storage and get secure proxy URL
      finalMediaUrl = await uploadMediaAndGetProxyUrl(
        supabaseAdmin,
        organizationId,
        instanceId,
        conversationId,
        parsed.base64,
        parsed.mime
      );

      console.log(`[${requestId}] ✅ Media ready for sending via proxy`);
    } else if (mediaUrl && typeof mediaUrl === "string" && mediaUrl.startsWith("http")) {
      // External URL - use as-is (user's responsibility)
      console.log(`[${requestId}] 📎 Using external media URL`);
      finalMediaUrl = mediaUrl;
    }

    // Send message via Wasender
    console.log(`[${requestId}] 📤 Sending ${finalType} message to Wasender...`);

    const sendResult = await sendWasenderMessage({
      apiKey: instance.wasender_api_key,
      to,
      type: finalType,
      text: finalType === "text" ? text : (mediaCaption ?? text ?? ""),
      mediaUrl: finalMediaUrl ?? undefined,
    });

    console.log(`[${requestId}] Wasender result:`, {
      success: sendResult.success,
      provider_message_id: sendResult.providerMessageId,
      error: sendResult.error,
    });

    // Save message to database (always, to preserve history)
    const { data: savedMessage, error: saveError } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversationId,
        instance_id: instanceId,
        content: finalType === "text" ? text : (mediaCaption ?? text ?? ""),
        direction: "outbound",
        message_type: finalType,
        media_url: finalMediaUrl,
        media_caption: mediaCaption ?? null,
        provider: "wasenderapi",
        provider_message_id: sendResult.providerMessageId,
        status: sendResult.success ? "sent" : "failed",
        is_from_bot: false,
      })
      .select()
      .single();

    if (saveError) {
      console.error(`[${requestId}] ⚠️ Failed to save message to DB:`, saveError);
    } else {
      console.log(`[${requestId}] ✅ Message saved to DB:`, savedMessage?.id);
    }

    // Update conversation
    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        current_instance_id: instanceId,
      })
      .eq("id", conversationId);

    // IMPORTANTE: sempre responder 200 para não “esconder” o JSON de erro no frontend.
    if (!sendResult.success) {
      console.error(`[${requestId}] ❌ Failed to send message:`, sendResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          message: savedMessage ?? null,
          providerMessageId: null,
          error: sendResult.error,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${requestId}] ✅ Message sent successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: savedMessage ?? null,
        providerMessageId: sendResult.providerMessageId,
        error: null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error(`[${requestId}] ❌ Unexpected error:`, error);

    // Também retornar 200 para expor a mensagem real no frontend.
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Erro inesperado" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
