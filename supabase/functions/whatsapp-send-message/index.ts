// Edge function for WhatsApp message sending - v2
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_MEDIA_TOKEN_SECRET = Deno.env.get("WHATSAPP_MEDIA_TOKEN_SECRET") ?? "";
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";

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
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function generateSignedStorageUrl(
  supabaseAdmin: any,
  storagePath: string,
  expiresInSeconds = 60 * 60 * 24 * 7
): Promise<string> {
  const bucket = "whatsapp-media";
  
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresInSeconds);
    
  if (error) {
    throw new Error(`Falha ao gerar URL assinada: ${error.message}`);
  }
  
  return data.signedUrl;
}

async function generateMediaProxyUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60 * 24 * 7,
  contentType?: string
): Promise<string> {
  if (!WHATSAPP_MEDIA_TOKEN_SECRET) {
    throw new Error("WHATSAPP_MEDIA_TOKEN_SECRET não configurado");
  }

  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const ct = contentType?.trim() || "";
  const dataToSign = ct ? `${storagePath}:${exp}:${ct}` : `${storagePath}:${exp}`;
  const token = await createHmacSignature(dataToSign, WHATSAPP_MEDIA_TOKEN_SECRET);

  const supabaseBase = SUPABASE_URL.replace(/\/$/, "");
  const proxyBaseUrl = `${supabaseBase}/functions/v1/whatsapp-media-proxy`;
  const ctParam = ct ? `&ct=${encodeURIComponent(ct)}` : "";

  return `${proxyBaseUrl}?path=${encodeURIComponent(storagePath)}&exp=${exp}&token=${token}${ctParam}`;
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

async function uploadMediaAndGetUrls(
  supabaseAdmin: any,
  organizationId: string,
  instanceId: string,
  conversationId: string,
  base64: string,
  mime: string
): Promise<{ signedUrl: string; proxyUrl: string; storagePath: string }> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const ext = extFromMime(mime);
  const timestamp = Date.now();
  const random = crypto.randomUUID().split('-')[0];
  
  const storagePath = `orgs/${organizationId}/instances/${instanceId}/${conversationId}/${timestamp}_${random}.${ext}`;
  const bucket = "whatsapp-media";

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, bytes, {
      contentType: mime,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Falha ao subir mídia no storage: ${uploadError.message}`);
  }

  const signedUrl = await generateSignedStorageUrl(supabaseAdmin, storagePath, 60 * 60 * 24 * 7);
  const proxyUrl = await generateMediaProxyUrl(storagePath, 60 * 60 * 24 * 7, mime);

  return { signedUrl, proxyUrl, storagePath };
}

// ============================================================================
// EVOLUTION API
// ============================================================================

async function sendEvolutionMessage(params: {
  instanceName: string;
  to: string;
  type: "text" | "image" | "audio" | "document" | "video";
  text?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  fileName?: string;
}) {
  const { instanceName, to, type, text, mediaUrl, mediaMimeType, fileName } = params;

  // Extrair apenas o número, removendo sufixo @s.whatsapp.net ou @g.us
  const number = to.includes("@") ? to.split("@")[0].replace(/\D/g, "") : to.replace(/\D/g, "");

  console.log("📡 Evolution API request:", {
    instance: instanceName,
    type,
    to: number.substring(0, 15) + "...",
    hasMedia: !!mediaUrl,
  });

  let endpoint = "";
  let payload: any = {};

  switch (type) {
    case "text":
      endpoint = `/message/sendText/${instanceName}`;
      payload = {
        number,
        text: text || "",
      };
      break;

    case "image":
      endpoint = `/message/sendMedia/${instanceName}`;
      payload = {
        number,
        mediatype: "image",
        media: mediaUrl,
        caption: text || "",
      };
      break;

    case "audio":
      endpoint = `/message/sendWhatsAppAudio/${instanceName}`;
      payload = {
        number,
        audio: mediaUrl,
      };
      break;

    case "video":
      endpoint = `/message/sendMedia/${instanceName}`;
      payload = {
        number,
        mediatype: "video",
        media: mediaUrl,
        caption: text || "",
      };
      break;

    case "document":
      endpoint = `/message/sendMedia/${instanceName}`;
      // Extrair nome real do arquivo da caption ou fileName
      const docFileName = fileName || text || "documento";
      // Garantir que mimetype está correto
      const docMimeType = mediaMimeType || "application/octet-stream";
      payload = {
        number,
        mediatype: "document",
        mimetype: docMimeType,
        media: mediaUrl,
        caption: text || docFileName,
        fileName: docFileName,
      };
      console.log("📄 Document payload:", { fileName: docFileName, mimetype: docMimeType });
      break;
  }

  const response = await fetch(`${EVOLUTION_API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));

  console.log("📡 Evolution response:", {
    status: response.status,
    ok: response.ok,
    hasKey: !!result?.key,
    error: result?.error || result?.message,
    response: result?.response,
  });

  if (response.ok && result?.key?.id) {
    return { success: true, providerMessageId: result.key.id, raw: result, errorCode: null };
  }

  // Parse error message for better user feedback
  let errorMsg = result?.message || result?.error || `HTTP ${response.status}`;
  const responseMessage = result?.response?.message;
  let errorCode = "UNKNOWN_ERROR";
  
  // Check for "exists: false" pattern in response (number not on WhatsApp)
  const responseArray = result?.response;
  const existsCheck = Array.isArray(responseArray) && responseArray.some((r: any) => r?.exists === false);
  
  // Check for common error patterns
  if (response.status === 400 || errorMsg === "Bad Request" || existsCheck) {
    // Check if it's a "not on WhatsApp" error
    if (existsCheck ||
        responseMessage?.includes?.("not on whatsapp") || 
        responseMessage?.includes?.("não está no WhatsApp") ||
        responseMessage?.includes?.("The number") ||
        errorMsg.includes?.("not registered")) {
      errorMsg = "Número não encontrado no WhatsApp. Verifique se o número está correto e possui WhatsApp ativo.";
      errorCode = "NUMBER_NOT_ON_WHATSAPP";
    } else if (responseMessage?.includes?.("blocked") || errorMsg.includes?.("blocked")) {
      errorMsg = "Este número pode ter bloqueado sua instância do WhatsApp.";
      errorCode = "NUMBER_BLOCKED";
    } else if (responseMessage?.includes?.("invalid") || errorMsg.includes?.("invalid number")) {
      errorMsg = "Formato de número inválido. Verifique o DDD e número.";
      errorCode = "INVALID_NUMBER_FORMAT";
    } else {
      // Generic bad request - likely invalid number
      errorMsg = `Falha ao enviar: número pode não estar no WhatsApp ou formato inválido (${number})`;
      errorCode = "BAD_REQUEST";
    }
  } else if (response.status === 401 || response.status === 403) {
    errorMsg = "Instância sem autorização. Reconecte o WhatsApp.";
    errorCode = "INSTANCE_UNAUTHORIZED";
  } else if (response.status === 404) {
    errorMsg = "Instância não encontrada ou desconectada. Verifique a conexão.";
    errorCode = "INSTANCE_NOT_FOUND";
  } else if (response.status >= 500) {
    errorMsg = "Servidor WhatsApp temporariamente indisponível. Tente novamente.";
    errorCode = "SERVER_ERROR";
  }
  
  return { success: false, providerMessageId: null, error: errorMsg, errorCode };
}

// ============================================================================
// WASENDER API (LEGACY)
// ============================================================================

async function sendWasenderMessage(params: {
  apiKey: string;
  to: string;
  type: "text" | "image" | "audio" | "document" | "video";
  text?: string;
  mediaUrl?: string;
}): Promise<{ success: boolean; providerMessageId: string | null; error?: string; raw?: any }> {
  const { apiKey, to, type, text, mediaUrl } = params;

  const payload: Record<string, any> = { to };

  switch (type) {
    case "text":
      payload.text = text ?? "";
      break;
    case "image":
      payload.imageUrl = mediaUrl;
      if (text) payload.text = text;
      break;
    case "audio":
      payload.audioUrl = mediaUrl;
      break;
    case "video":
      payload.videoUrl = mediaUrl;
      if (text) payload.text = text;
      break;
    case "document":
      payload.documentUrl = mediaUrl;
      if (text) payload.text = text;
      break;
  }

  const res = await fetch(`${WASENDER_BASE}/api/send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    const rawText = await res.text();
    json = { raw: rawText };
  }

  if (res.ok && json?.success) {
    const providerMessageId = json?.data?.msgId?.toString() || json?.data?.id || null;
    return { success: true, providerMessageId, raw: json };
  }

  const errorMsg = json?.message || json?.error || `HTTP ${res.status}`;
  return { success: false, providerMessageId: null, error: errorMsg };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
      mediaMimeType,
      mediaStoragePath,
      senderUserId, // ID do usuário que está enviando (para multi-atendimento)
    } = body;

    console.log(`[${requestId}] Request params:`, {
      organization_id: organizationId,
      instance_id: instanceId,
      conversation_id: conversationId,
      message_type: messageType || "text",
      has_media: !!mediaUrl || !!mediaStoragePath,
    });

    if (!organizationId || !instanceId || !conversationId) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros obrigatórios faltando" }),
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
      return new Response(
        JSON.stringify({ success: false, error: "Instância não encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Determinar qual provider usar
    const isEvolution = instance.provider === "evolution" && instance.evolution_instance_id;
    const isWasender = instance.wasender_api_key;

    if (!isEvolution && !isWasender) {
      return new Response(
        JSON.stringify({ success: false, error: "Instância não configurada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== VERIFICAÇÃO DE PERMISSÃO DE ENVIO ====================
    // Impede que múltiplos atendentes enviem mensagens na mesma conversa
    if (senderUserId) {
      // Buscar estado da conversa e permissões do usuário
      const { data: conversationState } = await supabaseAdmin
        .from("whatsapp_conversations")
        .select("status, assigned_user_id, designated_user_id")
        .eq("id", conversationId)
        .single();

      // Verificar se usuário é admin da instância
      const { data: instanceUser } = await supabaseAdmin
        .from("whatsapp_instance_users")
        .select("is_instance_admin")
        .eq("instance_id", instanceId)
        .eq("user_id", senderUserId)
        .single();

      const isInstanceAdmin = instanceUser?.is_instance_admin === true;

      // Se a conversa está atribuída a OUTRO usuário, bloquear envio (exceto admins)
      if (conversationState && !isInstanceAdmin) {
        const isAssignedToOther = conversationState.assigned_user_id && 
                                   conversationState.assigned_user_id !== senderUserId;
        const isDesignatedToOther = conversationState.designated_user_id && 
                                     conversationState.designated_user_id !== senderUserId;

        // Conversa está "assigned" e não é do usuário atual
        if (conversationState.status === 'assigned' && isAssignedToOther) {
          console.log(`[${requestId}] ❌ Blocked send: conversation assigned to ${conversationState.assigned_user_id}, sender is ${senderUserId}`);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Esta conversa está sendo atendida por outro vendedor. Você não pode enviar mensagens." 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Conversa está "autodistributed" para outro usuário
        if (conversationState.status === 'autodistributed' && isDesignatedToOther) {
          console.log(`[${requestId}] ❌ Blocked send: conversation designated to ${conversationState.designated_user_id}, sender is ${senderUserId}`);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Esta conversa foi designada para outro vendedor. Você não pode enviar mensagens." 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      console.log(`[${requestId}] ✅ Send permission verified for user ${senderUserId}`);
    }
    // ==================== FIM VERIFICAÇÃO DE PERMISSÃO ====================

    // Destination
    const toRaw = (chatId || phone || "").toString().trim();
    const to = toRaw.includes("@")
      ? toRaw
      : (toRaw.startsWith("+") ? toRaw : `+${toRaw.replace(/[^0-9]/g, "")}`);

    if (!to || to === "+") {
      return new Response(
        JSON.stringify({ success: false, error: "Destino inválido" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process media
    let finalMediaUrl: string | null = null;
    let finalMediaUrlForDb: string | null = null;
    let finalType: "text" | "image" | "audio" | "document" | "video" = (messageType as any) || "text";
    let text = (content ?? "").toString();

    // Debug: track newlines through the pipeline
    const newlineCount = (text.match(/\n/g) || []).length;
    console.log(`[${requestId}] 📝 Content newlines: ${newlineCount}, length: ${text.length}, first50: ${JSON.stringify(text.substring(0, 50))}`);

    // Check if sender name prefix is enabled for this organization
    let senderNamePrefix = "";
    if (senderUserId && text) {
      const { data: orgSettings } = await supabaseAdmin
        .from("organizations")
        .select("whatsapp_sender_name_prefix_enabled")
        .eq("id", organizationId)
        .single();
      
      if (orgSettings?.whatsapp_sender_name_prefix_enabled) {
        // Get sender's name from profiles
        const { data: senderProfile } = await supabaseAdmin
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", senderUserId)
          .single();
        
        if (senderProfile?.first_name) {
          const fullName = [senderProfile.first_name, senderProfile.last_name].filter(Boolean).join(" ");
          senderNamePrefix = `*${fullName}:*\n`;
          text = senderNamePrefix + text;
          console.log(`[${requestId}] 👤 Added sender name prefix: ${fullName}`);
        }
      }
    }

    // Media from storage path
    if (mediaStoragePath && typeof mediaStoragePath === "string") {
      if (!mediaStoragePath.startsWith(`orgs/${organizationId}/`)) {
        return new Response(
          JSON.stringify({ success: false, error: "Caminho de mídia inválido" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      finalMediaUrl = await generateSignedStorageUrl(supabaseAdmin, mediaStoragePath, 60 * 60 * 24 * 7);
      finalMediaUrlForDb = await generateMediaProxyUrl(mediaStoragePath, 60 * 60 * 24 * 7, mediaMimeType);
    } 
    // Media from data URL
    else if (mediaUrl && isDataUrl(mediaUrl)) {
      const parsed = parseDataUrl(mediaUrl);
      const { signedUrl, proxyUrl } = await uploadMediaAndGetUrls(
        supabaseAdmin,
        organizationId,
        instanceId,
        conversationId,
        parsed.base64,
        parsed.mime
      );
      
      finalMediaUrl = signedUrl;
      finalMediaUrlForDb = proxyUrl;
    } 
    // External URL
    else if (mediaUrl && typeof mediaUrl === "string" && mediaUrl.startsWith("http")) {
      finalMediaUrl = mediaUrl;
      finalMediaUrlForDb = mediaUrl;
    }

    // Send message
    let sendResult: { success: boolean; providerMessageId: string | null; error?: string; raw?: any };

    if (isEvolution) {
      console.log(`[${requestId}] 📤 Sending via Evolution API...`);
      // Para documentos, extrair nome do arquivo da caption
      const docFileName = finalType === "document" 
        ? (mediaCaption || body.fileName || "documento")
        : undefined;
      
      sendResult = await sendEvolutionMessage({
        instanceName: instance.evolution_instance_id,
        to,
        type: finalType,
        text: finalType === "text" ? text : (mediaCaption ?? text ?? ""),
        mediaUrl: finalMediaUrl ?? undefined,
        mediaMimeType: mediaMimeType,
        fileName: docFileName,
      });
    } else {
      console.log(`[${requestId}] 📤 Sending via Wasender API...`);
      sendResult = await sendWasenderMessage({
        apiKey: instance.wasender_api_key,
        to,
        type: finalType,
        text: finalType === "text" ? text : (mediaCaption ?? text ?? ""),
        mediaUrl: finalMediaUrl ?? undefined,
      });
    }

    console.log(`[${requestId}] Send result:`, {
      success: sendResult.success,
      provider: isEvolution ? "evolution" : "wasender",
      provider_message_id: sendResult.providerMessageId,
      error: sendResult.error,
    });

    // Save message to database (include error_details if failed)
    const messageInsert: Record<string, any> = {
      conversation_id: conversationId,
      instance_id: instanceId,
      content: finalType === "text" ? text : (mediaCaption ?? text ?? ""),
      direction: "outbound",
      message_type: finalType,
      media_url: finalMediaUrlForDb || finalMediaUrl,
      media_caption: mediaCaption ?? null,
      provider: isEvolution ? "evolution" : "wasenderapi",
      provider_message_id: sendResult.providerMessageId,
      status: sendResult.success ? "sent" : "failed",
      is_from_bot: false,
      sent_by_user_id: senderUserId || null, // Quem enviou (multi-atendimento)
    };
    
    // Add error details for failed messages
    if (!sendResult.success && sendResult.error) {
      messageInsert.error_details = sendResult.error;
    }

    const { data: savedMessage, error: saveError } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert(messageInsert)
      .select()
      .single();

    if (saveError) {
      console.error(`[${requestId}] ⚠️ Failed to save message to DB:`, saveError);
    } else if (savedMessage && finalType === 'audio' && (finalMediaUrlForDb || finalMediaUrl)) {
      // Check if auto-transcription is enabled for team audio (uses global org setting)
      const { data: instanceData } = await supabaseAdmin
        .from("whatsapp_instances")
        .select("organization_id")
        .eq("id", instanceId)
        .single();
      
      if (instanceData?.organization_id) {
        const { data: orgTranscribeSettings } = await supabaseAdmin
          .from("organizations")
          .select("whatsapp_transcribe_team_audio")
          .eq("id", instanceData.organization_id)
          .single();
        
        const shouldAutoTranscribe = (orgTranscribeSettings as any)?.whatsapp_transcribe_team_audio === true;
        
        if (shouldAutoTranscribe) {
          console.log(`[${requestId}] 🎤 Triggering auto-transcription for outbound audio (team)`);
          
          // Mark as pending
          await supabaseAdmin
            .from("whatsapp_messages")
            .update({ transcription_status: "pending" })
            .eq("id", savedMessage.id);
          
          // Fire and forget transcription
          fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio-message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              messageId: savedMessage.id,
              organizationId: instanceData.organization_id,
              mediaUrl: finalMediaUrlForDb || finalMediaUrl,
            }),
          }).then(async (res) => {
            const result = await res.json();
            console.log(`[${requestId}] 🎤 Transcription result:`, result);
          }).catch((err) => {
            console.error(`[${requestId}] ❌ Transcription error:`, err);
          });
        }
      }
    }

    // Update conversation - se usuário está enviando e conversa não está atribuída, atribuir
    const conversationUpdate: Record<string, any> = {
      last_message_at: new Date().toISOString(),
      unread_count: 0,
      current_instance_id: instanceId,
    };

    // Buscar estado atual da conversa
    const { data: currentConv } = await supabaseAdmin
      .from("whatsapp_conversations")
      .select("status, assigned_user_id")
      .eq("id", conversationId)
      .single();

    // ENVIO ATIVO: Se usuário está enviando e conversa não está atribuída, atribuir ao usuário
    if (senderUserId && currentConv && (currentConv.status !== 'assigned' || !currentConv.assigned_user_id)) {
      conversationUpdate.status = 'assigned';
      conversationUpdate.assigned_user_id = senderUserId;
      conversationUpdate.assigned_at = new Date().toISOString();
      conversationUpdate.closed_at = null;
      console.log(`[${requestId}] 📌 Assigning conversation to sender: ${senderUserId}`);
    }

    await supabaseAdmin
      .from("whatsapp_conversations")
      .update(conversationUpdate)
      .eq("id", conversationId);

    if (!sendResult.success) {
      // Log error
      try {
        await supabaseAdmin.from("error_logs").insert({
          organization_id: organizationId,
          error_type: "WHATSAPP_SEND_FAILED",
          error_message: sendResult.error || "Falha ao enviar mensagem",
          error_details: {
            instance_id: instanceId,
            conversation_id: conversationId,
            message_type: finalType,
            provider: isEvolution ? "evolution" : "wasender",
          },
          source: "whatsapp",
        });
      } catch {
        // Ignore log errors
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          message: savedMessage ?? null,
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
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error(`[${requestId}] ❌ Unexpected error:`, error);
    
    // Better error messages for common connection issues
    let errorMessage = error?.message || "Erro inesperado";
    if (error?.code === "ETIMEDOUT" || errorMessage.includes("timed out")) {
      errorMessage = "Servidor WhatsApp indisponível. Verifique se o Evolution API está online.";
    } else if (errorMessage.includes("Connection refused")) {
      errorMessage = "Conexão recusada pelo servidor WhatsApp. Verifique a configuração.";
    }
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
