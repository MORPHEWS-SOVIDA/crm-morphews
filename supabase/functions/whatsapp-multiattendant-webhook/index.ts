import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const WHATSAPP_WEBHOOK_SECRET = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
const WHATSAPP_MEDIA_TOKEN_SECRET = Deno.env.get("WHATSAPP_MEDIA_TOKEN_SECRET");

// Service role client (used across helpers)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const WHATSAPP_MEDIA_BUCKET = "whatsapp-media";
const MEDIA_URL_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7; // 7 days

// ============================================================================
// SECURITY - WEBHOOK VALIDATION
// ============================================================================

function validateWebhookSecret(req: Request): boolean {
  // Check if x-webhook-secret header is provided
  const providedSecret = req.headers.get("x-webhook-secret");
  
  // If header is provided, validate it
  if (providedSecret && WHATSAPP_WEBHOOK_SECRET) {
    // Constant-time comparison to prevent timing attacks
    if (providedSecret.length !== WHATSAPP_WEBHOOK_SECRET.length) {
      console.error("❌ Invalid webhook secret (length mismatch)");
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < providedSecret.length; i++) {
      result |= providedSecret.charCodeAt(i) ^ WHATSAPP_WEBHOOK_SECRET.charCodeAt(i);
    }
    
    if (result !== 0) {
      console.error("❌ Invalid webhook secret");
      return false;
    }
    
    console.log("✅ Webhook secret validated via header");
    return true;
  }
  
  // If no header provided, we'll validate later by checking if the instance exists
  // This is because WasenderAPI doesn't send custom headers, but we can validate
  // the request by confirming the sessionId matches a real instance in our database
  console.log("⚠️ No x-webhook-secret header - will validate via instance lookup");
  return true; // Allow the request to proceed, instance validation will happen later
}

// ============================================================================
// PHONE NUMBER UTILITIES
// ============================================================================

function normalizePhoneE164(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (!clean) return "";
  if (!clean.startsWith("55") && clean.length <= 11) {
    clean = "55" + clean;
  }
  return clean;
}

function extFromContentType(contentType: string | null, messageType?: string): string {
  const ct = (contentType || "").toLowerCase();
  
  // First, try to detect from content-type header
  if (ct.includes("image/jpeg")) return "jpg";
  if (ct.includes("image/png")) return "png";
  if (ct.includes("image/webp")) return "webp";
  if (ct.includes("image/gif")) return "gif";
  if (ct.includes("audio/ogg")) return "ogg";
  if (ct.includes("audio/mpeg") || ct.includes("audio/mp3")) return "mp3";
  if (ct.includes("audio/wav")) return "wav";
  if (ct.includes("audio/mp4") || ct.includes("audio/m4a")) return "m4a";
  if (ct.includes("video/mp4")) return "mp4";
  if (ct.includes("video/webm")) return "webm";
  if (ct.includes("application/pdf")) return "pdf";
  
  // If content-type is generic (octet-stream) or empty, infer from message type
  if (!ct || ct.includes("octet-stream")) {
    switch (messageType) {
      case "image": return "jpg"; // Default to jpg for images
      case "audio": return "ogg"; // WhatsApp audio is usually ogg
      case "video": return "mp4"; // Default to mp4 for videos
      case "document": return "pdf"; // Default to pdf for documents
      case "sticker": return "webp"; // Stickers are usually webp
    }
  }
  
  return "bin";
}

// Infer content-type from message type when server doesn't provide valid type
function inferContentType(serverContentType: string | null, messageType?: string): string {
  const ct = (serverContentType || "").toLowerCase();
  
  // If server gave us a valid specific type, use it
  if (ct && !ct.includes("octet-stream") && ct.includes("/")) {
    return serverContentType || "application/octet-stream";
  }
  
  // Otherwise, infer from message type
  switch (messageType) {
    case "image": return "image/jpeg";
    case "audio": return "audio/ogg";
    case "video": return "video/mp4";
    case "document": return "application/pdf";
    case "sticker": return "image/webp";
    default: return "application/octet-stream";
  }
}

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
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function generateMediaProxyUrl(storagePath: string, contentType?: string): Promise<string | null> {
  if (!WHATSAPP_MEDIA_TOKEN_SECRET) return null;

  const exp = Math.floor(Date.now() / 1000) + MEDIA_URL_EXPIRES_IN_SECONDS;
  const ct = (contentType || "").trim();
  const dataToSign = ct ? `${storagePath}:${exp}:${ct}` : `${storagePath}:${exp}`;
  const token = await createHmacSignature(dataToSign, WHATSAPP_MEDIA_TOKEN_SECRET);
  const base = SUPABASE_URL.replace(/\/$/, "");
  const ctParam = ct ? `&ct=${encodeURIComponent(ct)}` : "";
  return `${base}/functions/v1/whatsapp-media-proxy?path=${encodeURIComponent(storagePath)}&exp=${exp}&token=${token}${ctParam}`;
}

type StoredInboundMedia = {
  proxyUrl: string | null;
  signedUrl: string | null;
  storagePath: string;
  contentType: string | null;
};

async function createSignedUrlForStoragePath(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(WHATSAPP_MEDIA_BUCKET)
      .createSignedUrl(storagePath, MEDIA_URL_EXPIRES_IN_SECONDS);

    if (error) {
      console.warn("⚠️ Signed URL generation failed:", error);
      return null;
    }

    return data?.signedUrl ?? null;
  } catch (e) {
    console.warn("⚠️ Signed URL exception:", e);
    return null;
  }
}

async function downloadAndStoreInboundMedia(params: {
  organizationId: string;
  instanceId: string;
  conversationId: string;
  mediaUrl: string;
  messageType?: string; // NEW: to infer content-type when server doesn't provide
}): Promise<StoredInboundMedia | null> {
  const { organizationId, instanceId, conversationId, mediaUrl, messageType } = params;

  try {
    const resp = await fetch(mediaUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) {
      console.warn("⚠️ Media download failed:", { status: resp.status, mediaUrl });
      return null;
    }

    const serverContentType = resp.headers.get("content-type");
    const bytes = new Uint8Array(await resp.arrayBuffer());

    // Infer better content-type if server returned generic type
    const finalContentType = inferContentType(serverContentType, messageType);
    const ext = extFromContentType(finalContentType, messageType);
    
    console.log("📎 Storing inbound media:", {
      serverContentType,
      inferredContentType: finalContentType,
      extension: ext,
      messageType,
      size: bytes.length
    });

    const random = crypto.randomUUID().split("-")[0];
    const storagePath = `orgs/${organizationId}/instances/${instanceId}/${conversationId}/in_${Date.now()}_${random}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(WHATSAPP_MEDIA_BUCKET)
      .upload(storagePath, bytes, {
        contentType: finalContentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn("⚠️ Media upload failed:", uploadError);
      return null;
    }

    const proxyUrl = await generateMediaProxyUrl(storagePath, finalContentType);
    const signedUrl = await createSignedUrlForStoragePath(storagePath);

    return { proxyUrl, signedUrl, storagePath, contentType: finalContentType };
  } catch (e) {
    console.warn("⚠️ Media store exception:", e);
    return null;
  }
}

async function storeInboundBase64Media(params: {
  organizationId: string;
  instanceId: string;
  conversationId: string;
  base64: string;
  contentType: string | null;
  messageType?: string; // NEW: to infer content-type when not provided
}): Promise<StoredInboundMedia | null> {
  const { organizationId, instanceId, conversationId, base64, contentType, messageType } = params;

  try {
    const base64Data = base64.startsWith("data:")
      ? base64.split(",")[1] || ""
      : base64;

    if (!base64Data) return null;

    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    // Infer better content-type if not provided or generic
    const finalContentType = inferContentType(contentType, messageType);
    const ext = extFromContentType(finalContentType, messageType);
    
    console.log("📎 Storing base64 media:", {
      providedContentType: contentType,
      inferredContentType: finalContentType,
      extension: ext,
      messageType,
      size: bytes.length
    });

    const random = crypto.randomUUID().split("-")[0];
    const storagePath = `orgs/${organizationId}/instances/${instanceId}/${conversationId}/in_${Date.now()}_${random}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(WHATSAPP_MEDIA_BUCKET)
      .upload(storagePath, bytes, { contentType: finalContentType, upsert: true });

    if (uploadError) {
      console.warn("⚠️ Base64 media upload failed:", uploadError);
      return null;
    }

    const proxyUrl = await generateMediaProxyUrl(storagePath, finalContentType);
    const signedUrl = await createSignedUrlForStoragePath(storagePath);

    return { proxyUrl, signedUrl, storagePath, contentType: finalContentType };
  } catch (e) {
    console.warn("⚠️ Base64 media store exception:", e);
    return null;
  }
}

function extractPhoneFromWasenderPayload(msgData: any): { conversationId: string; sendablePhone: string } {
  const remoteJid = msgData.key?.remoteJid || msgData.remoteJid || "";

  // Grupo: não tentar normalizar como telefone
  if (remoteJid.includes("@g.us")) {
    const conversationId = remoteJid.replace("@g.us", "");
    console.log("Phone extraction (group):", { remoteJid, conversationId });
    return { conversationId, sendablePhone: "" };
  }

  const isLidFormat = remoteJid.includes("@lid");

  let conversationId = remoteJid
    .replace("@s.whatsapp.net", "")
    .replace("@c.us", "")
    .replace("@lid", "");

  let sendablePhone = "";

  if (msgData.key?.cleanedSenderPn) {
    sendablePhone = msgData.key.cleanedSenderPn;
  } else if (msgData.key?.senderPn) {
    sendablePhone = msgData.key.senderPn.replace("@s.whatsapp.net", "").replace("@c.us", "");
  } else if (!isLidFormat) {
    sendablePhone = conversationId;
  } else {
    sendablePhone = msgData.from?.replace("@s.whatsapp.net", "").replace("@c.us", "") || msgData.phone || "";
  }

  sendablePhone = normalizePhoneE164(sendablePhone);

  console.log("Phone extraction:", { remoteJid, isLidFormat, conversationId, sendablePhone });

  return { conversationId, sendablePhone };
}

// ============================================================================
// AI FUNCTIONS
// ============================================================================

type ConversationHistoryMessage = { role: string; content: string };

type WhatsAppMessageRow = {
  content: string | null;
  media_caption: string | null;
  direction: string | null;
  created_at: string | null;
  message_type: string | null;
};

async function getConversationHistory(
  conversationId: string,
  limit = 20
): Promise<ConversationHistoryMessage[]> {
  const { data: messages } = await supabase
    .from("whatsapp_messages")
    .select("content, direction, created_at, message_type, media_caption")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (messages ?? []) as WhatsAppMessageRow[];
  if (rows.length === 0) return [];

  return rows
    .reverse()
    .map((msg: WhatsAppMessageRow) => ({
      role: msg.direction === "inbound" ? "user" : "assistant",
      content: msg.content || msg.media_caption || "[mídia sem texto]",
    }))
    .filter((m: ConversationHistoryMessage) => !!m.content);
}

async function generateAIResponse(
  conversationHistory: Array<{ role: string; content: string }>,
  newMessage: string,
  leadInfo?: { name?: string; stage?: string; products?: string[] } | null
): Promise<string | null> {
  if (!LOVABLE_API_KEY) return null;

  try {
    const leadContext = leadInfo 
      ? `\n\nINFORMAÇÕES DO LEAD:\n- Nome: ${leadInfo.name || "N/A"}\n- Estágio: ${leadInfo.stage || "N/A"}\n- Produtos: ${leadInfo.products?.join(", ") || "N/A"}`
      : "";

    const systemPrompt = `Você é assistente virtual de um CRM de vendas. Ajude vendedores a gerenciar leads e conversas.${leadContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory.slice(-15),
          { role: "user", content: newMessage }
        ],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error("AI error:", error);
    return null;
  }
}

async function analyzeImage(imageUrl: string, base64Data?: string): Promise<string | null> {
  if (!LOVABLE_API_KEY) return null;
  try {
    let base64Image: string;
    let mimeType = "image/jpeg";
    
    if (base64Data) {
      base64Image = base64Data;
    } else if (imageUrl) {
      const resp = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!resp.ok) return null;
      const buf = await resp.arrayBuffer();
      base64Image = btoa(String.fromCharCode(...new Uint8Array(buf)));
      mimeType = resp.headers.get("content-type") || "image/jpeg";
    } else {
      return null;
    }
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Analise imagens e extraia informações relevantes de leads/negócios em português." },
          { role: "user", content: [
            { type: "text", text: "Analise esta imagem e extraia informações:" },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
          ]}
        ],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error("Image analysis error:", error);
    return null;
  }
}

async function transcribeAudio(audioUrl: string, base64Data?: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    let audioBlob: Blob;
    if (base64Data) {
      const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      audioBlob = new Blob([bytes], { type: 'audio/ogg' });
    } else if (audioUrl) {
      const resp = await fetch(audioUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!resp.ok) return null;
      audioBlob = await resp.blob();
    } else {
      return null;
    }
    
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");
    
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.text || null;
  } catch (error) {
    console.error("Transcription error:", error);
    return null;
  }
}

// ============================================================================
// DATABASE FUNCTIONS - UPSERT BY ORG + PHONE (NOVA LÓGICA)
// ============================================================================

async function findInstance(identifier: string, provider?: string) {
  console.log("Finding instance:", identifier, provider);
  
  if (provider === "wasenderapi" || !provider) {
    const { data: byApiKey } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("wasender_api_key", identifier)
      .single();
    if (byApiKey) return byApiKey;

    const { data: bySessionId } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("wasender_session_id", identifier)
      .single();
    if (bySessionId) return bySessionId;

    const { data: byId } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", identifier)
      .single();
    if (byId) return byId;
  }

  const { data: zapiInstance } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("z_api_instance_id", identifier)
    .single();
  if (zapiInstance) return zapiInstance;

  console.error("Instance not found:", identifier);
  return null;
}

async function findLeadByPhone(organizationId: string, phone: string) {
  const normalized = normalizePhoneE164(phone);
  const variants = [
    normalized,
    normalized.replace("55", ""),
    normalized.length === 13 ? normalized.slice(0, 4) + normalized.slice(5) : null,
    normalized.length === 12 ? normalized.slice(0, 4) + "9" + normalized.slice(4) : null,
  ].filter(Boolean);

  for (const variant of variants) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, name, whatsapp")
      .eq("organization_id", organizationId)
      .or(`whatsapp.ilike.%${variant}%,secondary_phone.ilike.%${variant}%`)
      .limit(1)
      .single();
    if (lead) return lead;
  }
  return null;
}

async function resolveOrCreateContact(organizationId: string, phone: string, name?: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("get_or_create_contact_by_phone", {
      _organization_id: organizationId,
      _phone: phone,
      _name: name || null,
    });
    if (error) {
      console.error("Error resolving contact:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Exception resolving contact:", err);
    return null;
  }
}

/**
 * NOVA LÓGICA: Upsert conversa por ORGANIZATION_ID + CHAT_ID (estável)
 * chat_id é o remoteJid original (ex: 5511999999999@s.whatsapp.net ou 123456@g.us)
 * Isso garante que o histórico NUNCA se perca ao trocar instância/número
 */
async function getOrCreateConversation(
  instanceId: string,
  organizationId: string,
  chatId: string, // remoteJid original - chave estável
  phoneForDisplay: string,
  sendablePhone: string,
  isGroup: boolean,
  groupSubject?: string,
  contactName?: string,
  contactProfilePic?: string
): Promise<{ conversation: any; isNew: boolean }> {
  const phoneForLookup = isGroup ? "" : normalizePhoneE164(sendablePhone || phoneForDisplay);
  const contactId = isGroup ? null : await resolveOrCreateContact(organizationId, phoneForLookup, contactName);

  // Determinar display_name
  const displayName = isGroup ? (groupSubject || "Grupo") : (contactName || null);

  console.log("Looking for conversation by org+chat_id:", organizationId, chatId);

  // BUSCAR POR ORG + CHAT_ID (estável, nunca muda)
  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("chat_id", chatId)
    .single();

  if (existing) {
    // Atualizar campos variáveis
    const updates: any = {
      updated_at: new Date().toISOString(),
      current_instance_id: instanceId,
      instance_id: instanceId,
    };

    if (displayName && !existing.display_name) updates.display_name = displayName;
    if (contactName && !existing.contact_name) updates.contact_name = contactName;
    if (contactProfilePic && !existing.contact_profile_pic) updates.contact_profile_pic = contactProfilePic;
    if (sendablePhone && existing.sendable_phone !== sendablePhone) updates.sendable_phone = sendablePhone;
    if (contactId && !existing.contact_id) updates.contact_id = contactId;
    if (isGroup && groupSubject && existing.group_subject !== groupSubject) updates.group_subject = groupSubject;

    // Auto-vincular lead se não tiver (apenas para não-grupos)
    if (!existing.lead_id && !isGroup) {
      const lead = await findLeadByPhone(organizationId, phoneForLookup);
      if (lead) updates.lead_id = lead.id;
    }

    await supabase.from("whatsapp_conversations").update(updates).eq("id", existing.id);

    console.log("Updated existing conversation:", existing.id);

    return {
      conversation: { ...existing, contact_id: existing.contact_id || contactId, current_instance_id: instanceId },
      isNew: false,
    };
  }

  // Criar nova conversa
  const lead = isGroup ? null : await findLeadByPhone(organizationId, phoneForLookup);

  const { data: newConv, error } = await supabase
    .from("whatsapp_conversations")
    .insert({
      instance_id: instanceId,
      current_instance_id: instanceId,
      organization_id: organizationId,
      chat_id: chatId, // Chave estável
      phone_number: phoneForDisplay,
      sendable_phone: isGroup ? null : (sendablePhone || null),
      customer_phone_e164: isGroup ? null : phoneForLookup,
      is_group: isGroup,
      group_subject: isGroup ? groupSubject : null,
      display_name: displayName,
      contact_name: contactName || lead?.name || null,
      contact_profile_pic: contactProfilePic || null,
      contact_id: contactId,
      lead_id: lead?.id || null,
      status: "pending", // Novas conversas começam como pendentes
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating conversation:", error);
    throw error;
  }

  console.log("Created new conversation:", newConv.id, "is_group:", isGroup, "lead_id:", lead?.id);
  return { conversation: newConv, isNew: true };
}

/**
 * IDEMPOTÊNCIA: Upsert message por provider_message_id para evitar duplicatas
 * Retorna mensagem existente se já existir, ou insere nova
 */
async function upsertMessage(
  conversationId: string,
  instanceId: string,
  content: string | null,
  direction: "inbound" | "outbound",
  messageType: string,
  providerMessageId: string | null,
  mediaUrl?: string,
  mediaCaption?: string,
  isFromBot = false,
  contactId?: string | null,
  provider = "wasenderapi",
  participantPhone?: string | null // Quem enviou em grupos
): Promise<{ data: any; isNew: boolean }> {
  // Se temos provider_message_id, verificar se já existe
  if (providerMessageId) {
    const { data: existing, error: existingError } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .or(`provider_message_id.eq.${providerMessageId},z_api_message_id.eq.${providerMessageId}`)
      .maybeSingle();
    
    if (existingError) {
      console.error("❌ Error checking existing message:", existingError);
    }
    
    if (existing) {
      console.log("⚠️ Message already exists (idempotent skip):", {
        provider_message_id: providerMessageId,
        existing_id: existing.id
      });
      return { data: existing, isNew: false };
    }
  }

  // Inserir nova mensagem
  const insertData: any = {
    conversation_id: conversationId,
    instance_id: instanceId,
    content,
    direction,
    message_type: messageType,
    provider,
    provider_message_id: providerMessageId || null,
    z_api_message_id: providerMessageId || null,
    media_url: mediaUrl || null,
    media_caption: mediaCaption || null,
    is_from_bot: isFromBot,
    status: direction === "outbound" ? "sent" : "delivered",
    contact_id: contactId || null,
  };

  const { data, error } = await supabase
    .from("whatsapp_messages")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    // Verificar se é erro de duplicidade (race condition)
    if (error.code === "23505" && providerMessageId) {
      console.log("⚠️ Duplicate detected via constraint, fetching existing:", providerMessageId);
      const { data: dup } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("provider_message_id", providerMessageId)
        .maybeSingle();
      if (dup) return { data: dup, isNew: false };
    }
    console.error("❌ Error saving message:", error);
    throw error;
  }

  // Update conversation
  const updateData: any = { last_message_at: new Date().toISOString() };
  if (direction === "inbound") {
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .select("unread_count")
      .eq("id", conversationId)
      .single();
    updateData.unread_count = (conv?.unread_count || 0) + 1;
  }

  await supabase.from("whatsapp_conversations").update(updateData).eq("id", conversationId);

  if (contactId) {
    await supabase.from("contacts").update({ last_activity_at: new Date().toISOString() }).eq("id", contactId);
  }

  console.log("✅ Message saved:", {
    id: data?.id,
    provider_message_id: providerMessageId,
    conversation_id: conversationId,
    direction,
    type: messageType,
    participant: participantPhone || null
  });
  
  return { data, isNew: true };
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

async function processWasenderMessage(instance: any, body: any) {
  let msgData = body.data?.messages;
  if (Array.isArray(msgData)) msgData = msgData[0];
  if (!msgData) msgData = body.data?.message || body.data;
  if (!msgData) {
    console.log("❌ No message data in payload");
    return null;
  }

  const isFromMe = msgData.key?.fromMe === true;
  
  // =========================================================================
  // EXTRAÇÃO DE remoteJid TOLERANTE - aceita múltiplos campos
  // =========================================================================
  const remoteJid = 
    msgData.key?.remoteJid || 
    msgData.remoteJid || 
    msgData.chatId ||
    msgData.chat_id ||
    msgData.from ||
    msgData.key?.chatId ||
    msgData.message?.key?.remoteJid ||
    "";
    
  const messageId = 
    msgData.key?.id || 
    msgData.id || 
    msgData.messageId || 
    msgData.message_id ||
    msgData.message?.key?.id ||
    "";
  
  // =========================================================================
  // GRUPO: Identificar por @g.us e extrair participant
  // Tolerante a variações no formato do payload
  // =========================================================================
  const isGroup = 
    remoteJid.endsWith("@g.us") || 
    msgData.isGroup === true ||
    msgData.is_group === true ||
    msgData.group === true ||
    (msgData.chatId || "").endsWith("@g.us");
    
  const groupSubject = 
    msgData.groupSubject || 
    msgData.group?.name || 
    msgData.groupName ||
    msgData.group_name ||
    msgData.chatName ||
    msgData.chat_name ||
    msgData.subject ||
    "";
  
  // Em grupos, participant é quem enviou a mensagem
  let participantPhone: string | null = null;
  if (isGroup) {
    const participantJid = 
      msgData.key?.participant || 
      msgData.participant ||
      msgData.sender ||
      msgData.from ||
      msgData.author ||
      "";
    participantPhone = participantJid
      .replace("@s.whatsapp.net", "")
      .replace("@c.us", "")
      .replace("@lid", "");
    if (participantPhone) {
      participantPhone = normalizePhoneE164(participantPhone);
    }
  }
  
  const { conversationId: phoneForConv, sendablePhone } = extractPhoneFromWasenderPayload(msgData);
  
  // Para grupos, não exigimos phone - usamos remoteJid como identificador
  if (!remoteJid && !phoneForConv && !sendablePhone) {
    console.log("❌ No identifier found in message");
    return null;
  }
  
  let text = msgData.messageBody || msgData.body || msgData.text ||
             msgData.message?.conversation || msgData.message?.extendedTextMessage?.text ||
             msgData.message?.imageMessage?.caption || msgData.message?.videoMessage?.caption || 
             msgData.caption || "";
  
  const senderName = msgData.pushName || msgData.senderName || msgData.name || msgData.notifyName || "";
  
  let messageType = "text";
  if (msgData.message?.imageMessage || msgData.type === "image" || msgData.messageType === "image") messageType = "image";
  else if (msgData.message?.audioMessage || msgData.type === "audio" || msgData.type === "ptt" || msgData.messageType === "audio") messageType = "audio";
  else if (msgData.message?.videoMessage || msgData.type === "video" || msgData.messageType === "video") messageType = "video";
  else if (msgData.message?.documentMessage || msgData.type === "document" || msgData.messageType === "document") messageType = "document";
  else if (msgData.message?.stickerMessage || msgData.type === "sticker") messageType = "sticker";
  
  let mediaUrl = msgData.mediaUrl || msgData.media_url || msgData.message?.imageMessage?.url ||
                 msgData.message?.audioMessage?.url || msgData.message?.videoMessage?.url ||
                 msgData.message?.documentMessage?.url || null;
                 
  const mediaBase64 = msgData.base64 || msgData.data?.base64 || msgData.media || null;
  
  // =========================================================================
  // LOG: Observabilidade detalhada
  // =========================================================================
  console.log("📩 Processing Wasender message:", {
    instance_id: instance.id,
    remoteJid,
    provider_message_id: messageId,
    is_group: isGroup,
    group_subject: groupSubject || null,
    participant: participantPhone,
    message_type: messageType,
    from_me: isFromMe,
    sender_name: senderName
  });
  
  // Usar remoteJid como chat_id estável (funciona para grupos e individuais)
  const chatIdForDb = remoteJid || (isGroup ? `${phoneForConv}@g.us` : `${sendablePhone}@s.whatsapp.net`);

  // Get or create conversation using stable chat_id
  const { conversation, isNew: isNewConversation } = await getOrCreateConversation(
    instance.id,
    instance.organization_id,
    chatIdForDb, // CHAVE ESTÁVEL
    phoneForConv || remoteJid.replace("@g.us", "").replace("@s.whatsapp.net", ""),
    sendablePhone,
    isGroup,
    isGroup ? groupSubject : undefined,
    senderName || undefined
  );

  // Auto-distribuição / reabertura por instância (somente inbound)
  if (!isFromMe) {
    const shouldAutoAssignNew = isNewConversation && instance.distribution_mode === "auto";
    const shouldReopen =
      !isNewConversation && (conversation.status === "closed" || !conversation.status);

    if (shouldAutoAssignNew || shouldReopen) {
      const { data: reopenResult, error: reopenError } = await supabase.rpc(
        "reopen_whatsapp_conversation",
        {
          p_conversation_id: conversation.id,
          p_instance_id: instance.id,
        }
      );

      if (reopenError) {
        console.error("❌ Error in reopen_whatsapp_conversation:", reopenError);
      } else {
        console.log("🔄 Reopen/auto-distribution result:", reopenResult);
      }
    }
  }

  // ✅ IMPORTANT: Wasender media URLs often expire / require auth.
  // To make the CRM reliably display images/audios, we download and store the media in our own storage
  // and save a signed URL (proxy preferred, signed-url fallback) in the DB.
  if (messageType !== "text") {
    const payloadMime: string | null =
      msgData.message?.imageMessage?.mimetype ||
      msgData.message?.audioMessage?.mimetype ||
      msgData.message?.videoMessage?.mimetype ||
      msgData.message?.documentMessage?.mimetype ||
      msgData.mimetype ||
      null;

    let stored: StoredInboundMedia | null = null;

    if (mediaUrl && typeof mediaUrl === "string" && mediaUrl.startsWith("http")) {
      stored = await downloadAndStoreInboundMedia({
        organizationId: instance.organization_id,
        instanceId: instance.id,
        conversationId: conversation.id,
        mediaUrl,
        messageType, // Pass message type for content-type inference
      });
    } else if (typeof mediaBase64 === "string" && mediaBase64.length > 50) {
      stored = await storeInboundBase64Media({
        organizationId: instance.organization_id,
        instanceId: instance.id,
        conversationId: conversation.id,
        base64: mediaBase64,
        contentType: payloadMime,
        messageType, // Pass message type for content-type inference
      });
    }

    if (stored?.proxyUrl || stored?.signedUrl) {
      mediaUrl = stored.proxyUrl || stored.signedUrl;
    }
  }

  // =========================================================================
  // IDEMPOTÊNCIA: Upsert message (não duplica)
  // =========================================================================
  const { data: savedMessage, isNew } = await upsertMessage(
    conversation.id,
    instance.id,
    text || null,
    isFromMe ? "outbound" : "inbound",
    messageType,
    messageId || null,
    mediaUrl,
    msgData.message?.imageMessage?.caption || msgData.message?.videoMessage?.caption || null,
    false,
    conversation.contact_id,
    "wasenderapi",
    participantPhone
  );
  
  if (!isNew) {
    console.log("⏭️ Message skipped (duplicate):", messageId);
    return savedMessage;
  }
  
  // Bot AI response (if enabled and inbound and NOT group)
  if (!isFromMe && !isGroup) {
    const { data: botConfig } = await supabase
      .from("whatsapp_bot_configs")
      .select("*")
      .eq("instance_id", instance.id)
      .single();
    
    if (botConfig?.is_enabled) {
      const history = await getConversationHistory(conversation.id);
      const aiResponse = await generateAIResponse(history, text);
      
      if (aiResponse && botConfig.supervisor_mode === false) {
        // TODO: Send AI response via Wasender API
        console.log("🤖 AI response generated:", aiResponse.substring(0, 100));
      }
    }
  }
  
  console.log("✅ Message processed successfully:", {
    id: savedMessage.id,
    provider_message_id: messageId,
    is_group: isGroup
  });
  return savedMessage;
}

async function processZapiMessage(instance: any, body: any) {
  const msgData = body;
  
  const phone = msgData.phone || msgData.from || "";
  const text = msgData.text?.message || msgData.text || msgData.body || "";
  const messageId = msgData.messageId || msgData.id || "";
  const isFromMe = msgData.isFromMe === true;
  const isGroup = msgData.isGroup === true;
  const groupSubject = msgData.chatName || msgData.groupName || "";
  
  // Participant em grupos
  let participantPhone: string | null = null;
  if (isGroup && msgData.participantPhone) {
    participantPhone = normalizePhoneE164(msgData.participantPhone);
  }
  
  if (!phone) {
    console.log("❌ No phone in Z-API message");
    return null;
  }
  
  const remoteJid = isGroup ? `${phone}@g.us` : `${phone}@s.whatsapp.net`;
  
  console.log("📩 Processing Z-API message:", {
    instance_id: instance.id,
    remoteJid,
    provider_message_id: messageId,
    is_group: isGroup,
    group_subject: groupSubject || null,
    participant: participantPhone,
    from_me: isFromMe
  });
  
  const { conversation, isNew: isNewConversation } = await getOrCreateConversation(
    instance.id,
    instance.organization_id,
    remoteJid,
    phone,
    phone,
    isGroup,
    isGroup ? groupSubject : undefined,
    msgData.senderName || undefined
  );

  // Auto-distribuição / reabertura por instância (somente inbound)
  if (!isFromMe) {
    const shouldAutoAssignNew = isNewConversation && instance.distribution_mode === "auto";
    const shouldReopen =
      !isNewConversation && (conversation.status === "closed" || !conversation.status);

    if (shouldAutoAssignNew || shouldReopen) {
      const { data: reopenResult, error: reopenError } = await supabase.rpc(
        "reopen_whatsapp_conversation",
        {
          p_conversation_id: conversation.id,
          p_instance_id: instance.id,
        }
      );

      if (reopenError) {
        console.error("❌ Error in reopen_whatsapp_conversation:", reopenError);
      } else {
        console.log("🔄 Reopen/auto-distribution result:", reopenResult);
      }
    }
  }
  
  let messageType = "text";
  if (msgData.image) messageType = "image";
  else if (msgData.audio) messageType = "audio";
  else if (msgData.video) messageType = "video";
  else if (msgData.document) messageType = "document";
  
  const mediaUrl = msgData.image?.imageUrl || msgData.audio?.audioUrl || 
                   msgData.video?.videoUrl || msgData.document?.documentUrl || null;
  
  const { data: savedMessage, isNew } = await upsertMessage(
    conversation.id,
    instance.id,
    text || null,
    isFromMe ? "outbound" : "inbound",
    messageType,
    messageId || null,
    mediaUrl,
    msgData.image?.caption || msgData.video?.caption || null,
    false,
    conversation.contact_id,
    "zapi",
    participantPhone
  );
  
  console.log("✅ Z-API message processed:", {
    id: savedMessage?.id,
    provider_message_id: messageId,
    is_new: isNew,
    is_group: isGroup
  });
  return savedMessage;
}

async function handleMessageStatusUpdate(instance: any, body: any) {
  const updates = body.data?.updates || body.data || [];
  const updateList = Array.isArray(updates) ? updates : [updates];
  
  for (const update of updateList) {
    const messageId = update.key?.id || update.id || update.messageId;
    if (!messageId) continue;
    
    let status = "sent";
    const updateStatus = update.status || update.update?.status;
    if (updateStatus === 2 || updateStatus === "DELIVERY_ACK") status = "delivered";
    else if (updateStatus === 3 || updateStatus === "READ") status = "read";
    else if (updateStatus === 4 || updateStatus === "PLAYED") status = "read";
    
    await supabase
      .from("whatsapp_messages")
      .update({ status })
      .or(`provider_message_id.eq.${messageId},z_api_message_id.eq.${messageId}`);
    
    console.log("Status updated:", messageId, status);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // =========================================================================
  // SECURITY: Validate webhook secret
  // =========================================================================
  if (!validateWebhookSecret(req)) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized - Invalid webhook secret" }), 
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    console.log("=== WhatsApp Webhook ===");
    console.log("Payload:", JSON.stringify(body, null, 2));

    let provider = "";
    let instanceIdentifier = "";
    
    if (body.sessionId || body.data?.sessionId) {
      provider = "wasenderapi";
      instanceIdentifier = body.sessionId || body.data?.sessionId;
    } else if (body.instanceId) {
      provider = "zapi";
      instanceIdentifier = body.instanceId;
    } else {
      console.log("Unknown webhook format");
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const instance = await findInstance(instanceIdentifier, provider);
    if (!instance) {
      console.error("Instance not found:", instanceIdentifier);
      return new Response(JSON.stringify({ success: false, error: "Instance not found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("Instance:", instance.name, instance.id);

    const event = body.event || body.type || "";
    console.log("Event:", event);

    if (event === "messages.received" || event === "messages.upsert" || event === "ReceivedCallback") {
      if (provider === "wasenderapi") await processWasenderMessage(instance, body);
      else if (provider === "zapi") await processZapiMessage(instance, body);
    } else if (event === "messages.update" || event === "MessageStatusCallback") {
      await handleMessageStatusUpdate(instance, body);
    } else if (event === "connection.update" || event === "session.status" || event === "StatusCallback") {
      // =========================================================================
      // CONNECTION STATUS UPDATE - Atualiza número conectado
      // =========================================================================
      const status = body.data?.state || body.data?.connection || body.data?.status || body.status || "";
      const isConnected = status === "open" || status === "connected" || status === "ready";
      
      // Tentar extrair o número do telefone conectado do payload
      let phoneNumber = null;
      
      // Wasender pode enviar o número em diferentes campos
      if (body.data?.phone) {
        phoneNumber = normalizePhoneE164(body.data.phone);
      } else if (body.data?.phoneNumber) {
        phoneNumber = normalizePhoneE164(body.data.phoneNumber);
      } else if (body.data?.connectedPhone) {
        phoneNumber = normalizePhoneE164(body.data.connectedPhone);
      } else if (body.data?.me?.user) {
        phoneNumber = normalizePhoneE164(body.data.me.user);
      } else if (body.data?.jid) {
        // O jid geralmente é algo como "5511999999999@s.whatsapp.net"
        const jidPhone = (body.data.jid || "").replace("@s.whatsapp.net", "").replace("@c.us", "");
        if (jidPhone) {
          phoneNumber = normalizePhoneE164(jidPhone);
        }
      } else if (body.phone) {
        phoneNumber = normalizePhoneE164(body.phone);
      }
      
      console.log("📱 Connection update:", {
        instance_id: instance.id,
        status,
        is_connected: isConnected,
        phone_detected: phoneNumber,
        raw_data: JSON.stringify(body.data || body).substring(0, 500)
      });
      
      // Preparar update para o banco
      const updateData: any = {
        is_connected: isConnected,
        status: isConnected ? "active" : "disconnected",
        updated_at: new Date().toISOString(),
      };
      
      // SEMPRE limpar QR quando conectado
      if (isConnected) {
        updateData.qr_code_base64 = null;
      }
      
      // Se temos um número, SEMPRE atualizar (para refletir troca de número)
      if (phoneNumber) {
        updateData.phone_number = phoneNumber;
        console.log("📱 Updating phone_number to:", phoneNumber);
      }
      
      await supabase.from("whatsapp_instances").update(updateData).eq("id", instance.id);
      console.log("✅ Connection status updated:", { instance_id: instance.id, is_connected: isConnected, phone_number: phoneNumber });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
