import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WASENDER_BASE = "https://www.wasenderapi.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalizePhoneE164(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (!clean) return "";
  if (!clean.startsWith("55") && clean.length <= 11) {
    clean = "55" + clean;
  }
  return clean;
}

function isDataUrl(v: string): boolean {
  return typeof v === "string" && v.startsWith("data:");
}

function parseDataUrl(dataUrl: string): { mime: string; base64: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) throw new Error("mediaUrl inválida (esperado data URL base64)");
  return { mime: m[1], base64: m[2] };
}

function extFromMime(mime: string): string {
  const mimeClean = mime.split(";")[0];
  if (mimeClean.includes("jpeg") || mimeClean.includes("jpg")) return "jpg";
  if (mimeClean.includes("png")) return "png";
  if (mimeClean.includes("webp")) return "webp";
  if (mimeClean.includes("gif")) return "gif";
  if (mimeClean.includes("mp3") || mimeClean.includes("mpeg")) return "mp3";
  if (mimeClean.includes("ogg")) return "ogg";
  if (mimeClean.includes("wav")) return "wav";
  if (mimeClean.includes("m4a") || mimeClean.includes("mp4")) return "m4a";
  if (mimeClean.includes("webm")) return "webm";
  if (mimeClean.includes("pdf")) return "pdf";
  return "bin";
}

/**
 * Upload base64 para Storage e retorna SIGNED URL (7 dias) - mais robusto
 */
async function uploadAndGetSignedUrl(
  organizationId: string,
  conversationId: string,
  base64: string,
  mime: string,
  folder: string
): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const ext = extFromMime(mime);
  const fileName = `${folder}/${organizationId}/${conversationId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const bucket = "whatsapp-media";

  console.log("Uploading to storage:", fileName, "Size:", bytes.length);

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, bytes, {
      contentType: mime.split(";")[0],
      upsert: true,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw new Error(`Falha ao subir mídia: ${uploadError.message}`);
  }

  // Sempre usar signed URL (7 dias) - robusto mesmo com bucket privado
  const { data: signed, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

  if (signError || !signed?.signedUrl) {
    // Fallback para URL pública
    const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    if (pubData?.publicUrl) {
      console.log("Using public URL:", pubData.publicUrl);
      return pubData.publicUrl;
    }
    throw new Error("Falha ao gerar URL assinada");
  }

  console.log("Using signed URL:", signed.signedUrl.substring(0, 100) + "...");
  return signed.signedUrl;
}

/**
 * Tenta múltiplos endpoints/payloads do WasenderAPI até conseguir
 */
async function wasenderRequest(apiKey: string, path: string, payload: any): Promise<{ ok: boolean; status: number; json: any }> {
  try {
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
  } catch (e: any) {
    console.error("Wasender request error:", e);
    return { ok: false, status: 0, json: { error: e.message } };
  }
}

async function sendWithFallbacks(params: {
  apiKey: string;
  to: string;
  type: "text" | "image" | "audio" | "document" | "video";
  text?: string;
  mediaUrl?: string;
}): Promise<{ success: boolean; providerMessageId: string | null; error?: string }> {
  const { apiKey, to, type, text, mediaUrl } = params;
  const attempts: Array<{ path: string; payload: any }> = [];

  if (type === "text") {
    attempts.push({ path: "/api/send-message", payload: { to, text: text ?? "" } });
  }

  if (type === "image") {
    attempts.push({ path: "/api/send-message", payload: { to, text: text ?? "", imageUrl: mediaUrl } });
    attempts.push({ path: "/api/send-message", payload: { to, caption: text ?? "", image: mediaUrl } });
    attempts.push({ path: "/api/send-image", payload: { to, imageUrl: mediaUrl, caption: text ?? "" } });
  }

  if (type === "audio") {
    attempts.push({ path: "/api/send-message", payload: { to, audioUrl: mediaUrl } });
    attempts.push({ path: "/api/send-message", payload: { to, audio: mediaUrl } });
    attempts.push({ path: "/api/send-audio", payload: { to, audioUrl: mediaUrl } });
  }

  if (type === "video") {
    attempts.push({ path: "/api/send-message", payload: { to, text: text ?? "", videoUrl: mediaUrl } });
    attempts.push({ path: "/api/send-video", payload: { to, videoUrl: mediaUrl, caption: text ?? "" } });
  }

  if (type === "document") {
    attempts.push({ path: "/api/send-message", payload: { to, text: text ?? "", documentUrl: mediaUrl } });
    attempts.push({ path: "/api/send-document", payload: { to, documentUrl: mediaUrl, caption: text ?? "" } });
  }

  let lastErr = "Falha ao enviar.";
  for (const a of attempts) {
    console.log("Trying:", a.path, JSON.stringify(a.payload));
    const r = await wasenderRequest(apiKey, a.path, a.payload);
    
    if (r.ok && r.json?.success) {
      const providerMessageId = r.json?.data?.id || r.json?.data?.messageId || r.json?.data?.key?.id || null;
      console.log("Send success! ID:", providerMessageId);
      return { success: true, providerMessageId };
    }

    const msg = r.json?.message || r.json?.error || r.json?.raw || `HTTP ${r.status}`;
    lastErr = `${a.path}: ${msg}`;
    console.log("Attempt failed:", lastErr);
  }

  return { success: false, providerMessageId: null, error: lastErr };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      organizationId,
      instanceId,
      conversationId,
      chatId, // NOVO: ID estável do chat (JID)
      phone,
      content,
      messageType = "text",
      mediaUrl,
      mediaCaption,
      mediaBase64,
      mediaMimeType,
    } = body;

    console.log("=== WhatsApp Send Message ===");
    console.log("ConversationId:", conversationId);
    console.log("ChatId:", chatId);
    console.log("InstanceId:", instanceId);
    console.log("MessageType:", messageType);
    console.log("Has media:", !!(mediaUrl || mediaBase64));

    if (!conversationId) {
      throw new Error("conversationId é obrigatório");
    }

    // Buscar conversa
    const { data: conversation, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select("*, current_instance_id, chat_id")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      throw new Error("Conversa não encontrada");
    }

    // Determinar instância
    const effectiveInstanceId = instanceId || conversation.current_instance_id || conversation.instance_id;
    if (!effectiveInstanceId) {
      throw new Error("Nenhuma instância disponível");
    }

    // Buscar instância
    const { data: instance, error: instError } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", effectiveInstanceId)
      .single();

    if (instError || !instance) {
      throw new Error("Instância não encontrada");
    }

    if (!instance.wasender_api_key) {
      throw new Error("Instância não configurada (sem API key)");
    }

    if (!instance.is_connected) {
      throw new Error("WhatsApp não está conectado");
    }

    // Determinar destino: chatId (estável) > sendable_phone > phone_number
    let to = chatId || conversation.chat_id || conversation.sendable_phone || conversation.phone_number || phone || "";
    
    // Se não parece um JID, formatar como telefone
    if (!to.includes("@")) {
      to = normalizePhoneE164(to);
      to = `+${to}`;
    }

    if (!to || to.length < 8) {
      throw new Error("Destino inválido");
    }

    console.log("Sending to:", to);

    // Processar mídia
    let finalMediaUrl: string | null = null;
    const finalType = (messageType as "text" | "image" | "audio" | "video" | "document") || "text";
    const text = content ?? "";

    if (mediaUrl && isDataUrl(mediaUrl)) {
      console.log("Processing data URL media...");
      const parsed = parseDataUrl(mediaUrl);
      const folder = finalType === "audio" ? "audio" : finalType === "image" ? "images" : finalType === "video" ? "videos" : "docs";
      finalMediaUrl = await uploadAndGetSignedUrl(conversation.organization_id, conversationId, parsed.base64, parsed.mime, folder);
    } else if (mediaBase64) {
      console.log("Processing base64 media...");
      const dataUrl = mediaMimeType ? `data:${mediaMimeType};base64,${mediaBase64}` : mediaBase64;
      if (isDataUrl(dataUrl)) {
        const parsed = parseDataUrl(dataUrl);
        const folder = finalType === "audio" ? "audio" : finalType === "image" ? "images" : "docs";
        finalMediaUrl = await uploadAndGetSignedUrl(conversation.organization_id, conversationId, parsed.base64, parsed.mime, folder);
      }
    } else if (mediaUrl && (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://"))) {
      finalMediaUrl = mediaUrl;
    }

    // Validar mídia obrigatória
    if (["image", "audio", "video", "document"].includes(finalType) && !finalMediaUrl) {
      throw new Error("Falha ao processar mídia para envio");
    }

    console.log("Final media URL:", finalMediaUrl?.substring(0, 80));

    // Enviar mensagem com fallbacks
    const sendResult = await sendWithFallbacks({
      apiKey: instance.wasender_api_key,
      to,
      type: finalType,
      text: finalType === "text" ? text : (mediaCaption ?? text ?? ""),
      mediaUrl: finalMediaUrl || undefined,
    });

    // SEMPRE salvar mensagem no DB (mesmo se falhou envio)
    const { data: savedMessage, error: saveError } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversationId,
        instance_id: effectiveInstanceId,
        content: finalType === "text" ? text : (mediaCaption ?? text ?? ""),
        direction: "outbound",
        message_type: finalType,
        media_url: finalMediaUrl,
        media_caption: mediaCaption || null,
        provider: "wasenderapi",
        provider_message_id: sendResult.providerMessageId,
        z_api_message_id: sendResult.providerMessageId, // Compatibilidade
        status: sendResult.success ? "sent" : "failed",
        is_from_bot: false,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Save message error:", saveError);
    }

    // Atualizar conversa
    await supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        current_instance_id: effectiveInstanceId,
      })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({
        success: sendResult.success,
        message: savedMessage || null,
        providerMessageId: sendResult.providerMessageId,
        error: sendResult.success ? null : sendResult.error,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("whatsapp-send-message error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Retorna 200 para não quebrar UI
    });
  }
});
