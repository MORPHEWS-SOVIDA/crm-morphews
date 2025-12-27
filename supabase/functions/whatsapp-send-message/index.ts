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

const WASENDER_BASE = "https://wasenderapi.com";

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
  
  if (!PUBLIC_APP_URL) {
    throw new Error("PUBLIC_APP_URL não configurado - impossível gerar URL do proxy");
  }
  
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  
  // Create signature: HMAC-SHA256(path + exp, secret)
  const dataToSign = `${storagePath}:${exp}`;
  const token = await createHmacSignature(dataToSign, WHATSAPP_MEDIA_TOKEN_SECRET);
  
  // Build proxy URL with querystring
  const baseUrl = PUBLIC_APP_URL.replace(/\/$/, "");
  const proxyUrl = `${baseUrl}/api/whatsapp/media?path=${encodeURIComponent(storagePath)}&exp=${exp}&token=${token}`;
  
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
  console.log("📡 Wasender request:", { path, to: payload.to, hasMedia: !!payload.imageUrl || !!payload.audioUrl || !!payload.documentUrl || !!payload.videoUrl });
  
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
    error: json?.error || json?.message 
  });

  return { ok: res.ok, status: res.status, json };
}

async function sendWithFallbacks(params: {
  apiKey: string;
  to: string;
  type: "text" | "image" | "audio" | "document" | "video";
  text?: string;
  mediaUrl?: string;
}) {
  const { apiKey, to, type, text, mediaUrl } = params;

  const attempts: Array<{ path: string; payload: any }> = [];

  if (type === "text") {
    attempts.push({
      path: "/api/send-message",
      payload: { to, text: text ?? "" },
    });
  }

  if (type === "image") {
    // Try different field names for image URL
    attempts.push({
      path: "/api/send-message",
      payload: { to, text: text ?? "", imageUrl: mediaUrl },
    });
    attempts.push({
      path: "/api/send-message",
      payload: { to, caption: text ?? "", image: mediaUrl },
    });
    attempts.push({
      path: "/api/send-image",
      payload: { to, imageUrl: mediaUrl, caption: text ?? "" },
    });
    attempts.push({
      path: "/api/send-image",
      payload: { to, image: mediaUrl, caption: text ?? "" },
    });
  }

  if (type === "audio") {
    attempts.push({
      path: "/api/send-message",
      payload: { to, audioUrl: mediaUrl },
    });
    attempts.push({
      path: "/api/send-message",
      payload: { to, audio: mediaUrl },
    });
    attempts.push({
      path: "/api/send-audio",
      payload: { to, audioUrl: mediaUrl },
    });
    attempts.push({
      path: "/api/send-audio",
      payload: { to, audio: mediaUrl },
    });
  }

  if (type === "video") {
    attempts.push({
      path: "/api/send-message",
      payload: { to, text: text ?? "", videoUrl: mediaUrl },
    });
    attempts.push({
      path: "/api/send-message",
      payload: { to, caption: text ?? "", video: mediaUrl },
    });
    attempts.push({
      path: "/api/send-video",
      payload: { to, videoUrl: mediaUrl, caption: text ?? "" },
    });
  }

  if (type === "document") {
    attempts.push({
      path: "/api/send-message",
      payload: { to, text: text ?? "", documentUrl: mediaUrl },
    });
    attempts.push({
      path: "/api/send-message",
      payload: { to, caption: text ?? "", document: mediaUrl },
    });
    attempts.push({
      path: "/api/send-document",
      payload: { to, documentUrl: mediaUrl, caption: text ?? "" },
    });
  }

  let lastErr = "Falha ao enviar mensagem.";
  for (const a of attempts) {
    const r = await wasenderRequest(apiKey, a.path, a.payload);
    if (r.ok && r.json?.success) {
      const providerMessageId =
        r.json?.data?.id || r.json?.data?.messageId || r.json?.data?.key?.id || null;
      return { success: true, providerMessageId, raw: r.json };
    }

    const msg = r.json?.message || r.json?.error || r.json?.raw || `HTTP ${r.status}`;
    lastErr = `${a.path}: ${msg}`;
  }

  return { success: false, providerMessageId: null, error: lastErr };
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!instanceId) {
      console.error(`[${requestId}] ❌ Missing instanceId`);
      return new Response(
        JSON.stringify({ success: false, error: "instanceId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!conversationId) {
      console.error(`[${requestId}] ❌ Missing conversationId`);
      return new Response(
        JSON.stringify({ success: false, error: "conversationId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load instance
    const { data: instance, error: instErr } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instanceId)
      .single();

    if (instErr || !instance) {
      console.error(`[${requestId}] ❌ Instance not found:`, instanceId);
      return new Response(
        JSON.stringify({ success: false, error: "Instância não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!instance.wasender_api_key) {
      console.error(`[${requestId}] ❌ Instance not configured (no API key)`);
      return new Response(
        JSON.stringify({ success: false, error: "Instância Wasender não configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!instance.is_connected) {
      console.error(`[${requestId}] ❌ Instance not connected`);
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp não está conectado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Destination: prefer chatId (stable JID), fallback to phone
    const to = (chatId || phone || "").toString().trim();
    if (!to) {
      console.error(`[${requestId}] ❌ No destination (chatId/phone)`);
      return new Response(
        JSON.stringify({ success: false, error: "Destino inválido (chatId/phone vazio)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process media if present
    let finalMediaUrl: string | null = null;
    let finalType: "text" | "image" | "audio" | "document" | "video" =
      (messageType as any) || "text";
    let text = (content ?? "").toString();

    if (mediaUrl && isDataUrl(mediaUrl)) {
      console.log(`[${requestId}] 📎 Processing media attachment (data URL)`);
      
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
    
    const sendResult = await sendWithFallbacks({
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

    // Return appropriate status code based on send result
    if (!sendResult.success) {
      console.error(`[${requestId}] ❌ Failed to send message:`, sendResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          message: savedMessage ?? null,
          providerMessageId: null,
          error: sendResult.error,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
