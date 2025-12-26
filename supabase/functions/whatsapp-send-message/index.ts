import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const WASENDER_BASE = "https://wasenderapi.com";

function isDataUrl(v: string) {
  return typeof v === "string" && v.startsWith("data:");
}

function parseDataUrl(dataUrl: string) {
  // data:<mime>;base64,<payload>
  const m = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!m) throw new Error("mediaUrl inválida (esperado data URL base64)");
  return { mime: m[1], base64: m[2] };
}

function extFromMime(mime: string) {
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("mp3")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("m4a")) return "m4a";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("pdf")) return "pdf";
  return "bin";
}

async function uploadAndGetSignedUrl(
  supabaseAdmin: any,
  organizationId: string,
  base64: string,
  mime: string,
  folder: string
) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const ext = extFromMime(mime);
  const fileName = `${folder}/${organizationId}/${crypto.randomUUID()}.${ext}`;
  const bucket = "whatsapp-media";

  const up = await supabaseAdmin.storage
    .from(bucket)
    .upload(fileName, bytes, {
      contentType: mime,
      upsert: false,
    });

  if (up.error) {
    throw new Error(`Falha ao subir mídia no storage: ${up.error.message}`);
  }

  // Always signed URL (robust even for private buckets)
  const signed = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

  if (signed.error || !signed.data?.signedUrl) {
    // fallback to publicUrl (if bucket is public)
    const pub = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName);
    const publicUrl = pub?.data?.publicUrl;
    if (!publicUrl) {
      throw new Error("Falha ao gerar URL assinada e URL pública indisponível.");
    }
    return publicUrl;
  }

  return signed.data.signedUrl;
}

async function wasenderRequest(apiKey: string, path: string, payload: any) {
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

  // Strategy:
  // Try most common endpoint: /api/send-message
  // Then try variants of field names (imageUrl/image, audioUrl/audio, documentUrl/document, videoUrl/video)
  // Then try specialized endpoints if available.
  const attempts: Array<{ path: string; payload: any }> = [];

  if (type === "text") {
    attempts.push({
      path: "/api/send-message",
      payload: { to, text: text ?? "" },
    });
  }

  if (type === "image") {
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

  let lastErr = "Falha ao enviar.";
  for (const a of attempts) {
    const r = await wasenderRequest(apiKey, a.path, a.payload);
    if (r.ok && r.json?.success) {
      const providerMessageId =
        r.json?.data?.id || r.json?.data?.messageId || r.json?.data?.key?.id || null;
      return { success: true, providerMessageId, raw: r.json };
    }

    // surface better error
    const msg = r.json?.message || r.json?.error || r.json?.raw || `HTTP ${r.status}`;
    lastErr = `${a.path}: ${msg}`;
  }

  return { success: false, providerMessageId: null, error: lastErr };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const {
      organizationId,
      instanceId,
      conversationId,
      // IMPORTANT: use chatId when available (stable)
      chatId,
      phone,
      content,
      messageType,
      mediaUrl,
      mediaCaption,
    } = body;

    if (!organizationId) throw new Error("organizationId é obrigatório");
    if (!instanceId) throw new Error("instanceId é obrigatório");
    if (!conversationId) throw new Error("conversationId é obrigatório");

    // Load instance
    const { data: instance, error: instErr } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instanceId)
      .single();

    if (instErr || !instance) throw new Error("Instância não encontrada");
    if (!instance.wasender_api_key) throw new Error("Instância Wasender não configurada");
    if (!instance.is_connected) throw new Error("WhatsApp não está conectado");

    // Destination: prefer chatId (stable JID), fallback to phone
    const to = (chatId || phone || "").toString().trim();
    if (!to) throw new Error("Destino inválido (chatId/phone vazio)");

    // If mediaUrl is a data URL, upload and create signed URL
    let finalMediaUrl: string | null = null;
    let finalType: "text" | "image" | "audio" | "document" | "video" =
      (messageType as any) || "text";

    let text = (content ?? "").toString();

    if (mediaUrl && isDataUrl(mediaUrl)) {
      const parsed = parseDataUrl(mediaUrl);
      const folder =
        finalType === "audio"
          ? "audio"
          : finalType === "image"
          ? "images"
          : finalType === "video"
          ? "videos"
          : "docs";
      finalMediaUrl = await uploadAndGetSignedUrl(
        supabaseAdmin,
        organizationId,
        parsed.base64,
        parsed.mime,
        folder
      );
    } else if (mediaUrl && typeof mediaUrl === "string") {
      // Already a URL
      finalMediaUrl = mediaUrl;
    }

    // Build send
    const sendResult = await sendWithFallbacks({
      apiKey: instance.wasender_api_key,
      to,
      type: finalType,
      text: finalType === "text" ? text : (mediaCaption ?? text ?? ""),
      mediaUrl: finalMediaUrl ?? undefined,
    });

    // Save message no matter what (so you never lose history)
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
      console.error("Save error:", saveError);
      // still return send result
    }

    // Update conversation (never delete history; always keep last_message_at)
    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        current_instance_id: instanceId,
      })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({
        success: sendResult.success,
        message: savedMessage ?? null,
        providerMessageId: sendResult.providerMessageId,
        error: sendResult.success ? null : sendResult.error,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("whatsapp-send-message error:", error);
    // Return 200 to not break UI, but include success=false
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
