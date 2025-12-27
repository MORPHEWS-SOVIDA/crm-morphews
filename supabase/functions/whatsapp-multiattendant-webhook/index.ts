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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// SECURITY - WEBHOOK VALIDATION
// ============================================================================

function validateWebhookSecret(req: Request): boolean {
  // If no secret configured, allow (backwards compatibility during migration)
  if (!WHATSAPP_WEBHOOK_SECRET) {
    console.warn("⚠️ WHATSAPP_WEBHOOK_SECRET not configured - webhook validation disabled");
    return true;
  }
  
  const providedSecret = req.headers.get("x-webhook-secret");
  if (!providedSecret) {
    console.error("❌ Missing x-webhook-secret header");
    return false;
  }
  
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
  
  console.log("✅ Webhook secret validated");
  return true;
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

async function getConversationHistory(conversationId: string, limit = 20): Promise<Array<{ role: string; content: string }>> {
  const { data: messages } = await supabase
    .from("whatsapp_messages")
    .select("content, direction, created_at, message_type, media_caption")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!messages || messages.length === 0) return [];

  return messages.reverse().map((msg) => ({
    role: msg.direction === "inbound" ? "user" : "assistant",
    content: msg.content || msg.media_caption || "[mídia sem texto]",
  })).filter(m => m.content);
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
) {
  const phoneForLookup = isGroup ? "" : normalizePhoneE164(sendablePhone || phoneForDisplay);
  const contactId = isGroup ? null : await resolveOrCreateContact(organizationId, phoneForLookup, contactName);
  
  // Determinar display_name
  const displayName = isGroup 
    ? (groupSubject || "Grupo") 
    : (contactName || null);
  
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
    return { ...existing, contact_id: existing.contact_id || contactId, current_instance_id: instanceId };
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
      status: "open",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating conversation:", error);
    throw error;
  }

  console.log("Created new conversation:", newConv.id, "is_group:", isGroup, "lead_id:", lead?.id);
  return newConv;
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
  const conversation = await getOrCreateConversation(
    instance.id,
    instance.organization_id,
    chatIdForDb, // CHAVE ESTÁVEL
    phoneForConv || remoteJid.replace("@g.us", "").replace("@s.whatsapp.net", ""),
    sendablePhone,
    isGroup,
    isGroup ? groupSubject : undefined,
    senderName || undefined
  );

  // Process media (image analysis, audio transcription)
  if (messageType === "audio" && (mediaUrl || mediaBase64)) {
    const transcription = await transcribeAudio(mediaUrl || "", mediaBase64);
    if (transcription) {
      text = `[Áudio transcrito]: ${transcription}`;
    }
  }
  
  if (messageType === "image" && (mediaUrl || mediaBase64)) {
    const analysis = await analyzeImage(mediaUrl || "", mediaBase64);
    if (analysis && !text) {
      text = `[Imagem analisada]: ${analysis}`;
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
  
  const conversation = await getOrCreateConversation(
    instance.id,
    instance.organization_id,
    remoteJid,
    phone,
    phone,
    isGroup,
    isGroup ? groupSubject : undefined,
    msgData.senderName || undefined
  );
  
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
