import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// PHONE NUMBER UTILITIES - Critical for multi-tenant scale
// ============================================================================

/**
 * Extracts the REAL phone number from WasenderAPI payload
 * WasenderAPI uses LID format internally which is NOT a sendable phone number
 * 
 * Priority order:
 * 1. cleanedSenderPn - best source, already cleaned
 * 2. senderPn - contains @s.whatsapp.net suffix
 * 3. remoteJid - ONLY if not LID format
 */
function extractPhoneFromWasenderPayload(msgData: any): { conversationId: string; sendablePhone: string } {
  const remoteJid = msgData.key?.remoteJid || msgData.remoteJid || "";
  const isLidFormat = remoteJid.includes("@lid");
  
  // For conversation identification, we use remoteJid as-is (unique per contact)
  // This ensures we don't create duplicate conversations
  let conversationId = remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "").replace("@lid", "");
  
  // For sending messages, we need the REAL phone number
  let sendablePhone = "";
  
  // Priority 1: cleanedSenderPn (best - already just digits)
  if (msgData.key?.cleanedSenderPn) {
    sendablePhone = msgData.key.cleanedSenderPn;
  } 
  // Priority 2: senderPn (needs cleaning)
  else if (msgData.key?.senderPn) {
    sendablePhone = msgData.key.senderPn.replace("@s.whatsapp.net", "").replace("@c.us", "");
  }
  // Priority 3: remoteJid ONLY if not LID format
  else if (!isLidFormat) {
    sendablePhone = conversationId;
  }
  // Priority 4: other fields
  else {
    sendablePhone = msgData.from?.replace("@s.whatsapp.net", "").replace("@c.us", "") || 
                    msgData.phone || "";
  }
  
  // Normalize sendable phone to E.164-like format (just digits, with country code)
  sendablePhone = normalizePhoneE164(sendablePhone);
  
  console.log("Phone extraction:", { 
    remoteJid, 
    isLidFormat, 
    conversationId, 
    sendablePhone,
    source: msgData.key?.cleanedSenderPn ? "cleanedSenderPn" : 
            msgData.key?.senderPn ? "senderPn" : 
            !isLidFormat ? "remoteJid" : "fallback"
  });
  
  return { conversationId, sendablePhone };
}

/**
 * Normalize phone to E.164-like format (digits only with country code)
 * Brazilian phones: 55 + DDD (2 digits) + number (8-9 digits)
 */
function normalizePhoneE164(phone: string): string {
  // Remove all non-digits
  let clean = phone.replace(/\D/g, "");
  
  // Handle empty
  if (!clean) return "";
  
  // Add Brazil country code if missing
  if (!clean.startsWith("55") && clean.length <= 11) {
    clean = "55" + clean;
  }
  
  return clean;
}

/**
 * Legacy normalize function for backward compatibility
 */
function normalizePhone(phone: string): string {
  return normalizePhoneE164(phone);
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
  if (!LOVABLE_API_KEY) {
    console.log("LOVABLE_API_KEY not configured, skipping AI response");
    return null;
  }

  try {
    console.log("=== Generating AI response ===");
    
    const leadContext = leadInfo 
      ? `\n\nINFORMAÇÕES DO LEAD NO CRM:
- Nome: ${leadInfo.name || "Não cadastrado"}
- Estágio do funil: ${leadInfo.stage || "Não definido"}
- Produtos de interesse: ${leadInfo.products?.join(", ") || "Não definido"}`
      : "";

    const systemPrompt = `Você é uma assistente virtual inteligente e profissional para vendedores de um CRM de vendas chamado Morphews.

SEU PAPEL:
- Você ajuda vendedores a gerenciar leads, agendar reuniões e organizar informações de clientes
- Você analisa conversas para extrair dados relevantes (nomes, telefones, emails, datas de reunião, etc.)
- Você é proativa, educada e sempre busca ajudar o vendedor a fechar mais vendas

CAPACIDADES:
- Analisar imagens e screenshots para extrair informações de leads
- Transcrever áudios automaticamente
- Identificar informações importantes em conversas
- Sugerir próximos passos baseado no contexto
- Lembrar o contexto da conversa anterior

REGRAS:
1. Sempre analise o CONTEXTO das mensagens anteriores antes de responder
2. Se o usuário enviar uma imagem com dados de lead/reunião, extraia as informações E pergunte se quer cadastrar
3. Seja concisa mas completa
4. Use emojis moderadamente para ser amigável
5. Se não tiver certeza de algo, pergunte para confirmar
6. Priorize extrair: nome, telefone, email, data/hora de reunião
7. Quando identificar uma reunião marcada, confirme os detalhes: data, hora, com quem
${leadContext}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-15),
      { role: "user", content: newMessage }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI response error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error("Error generating AI response:", error);
    return null;
  }
}

async function analyzeImage(imageUrl: string, base64Data?: string): Promise<string | null> {
  if (!LOVABLE_API_KEY) return null;

  try {
    console.log("=== Starting image analysis ===");
    
    let base64Image: string;
    let mimeType = "image/jpeg";
    
    if (base64Data) {
      base64Image = base64Data;
    } else if (imageUrl) {
      const imageResponse = await fetch(imageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      if (!imageResponse.ok) return null;
      
      const imageBuffer = await imageResponse.arrayBuffer();
      base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
    } else {
      return null;
    }
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um assistente que analisa imagens enviadas por WhatsApp para extrair informações de leads e negócios.
            
Ao analisar a imagem, extraia informações relevantes como:
- Nomes de pessoas
- Números de telefone
- Emails
- Datas e horários de reuniões
- Informações de empresas
- Valores ou preços
- Qualquer texto legível relevante

Responda de forma clara e concisa em português, listando as informações encontradas.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analise esta imagem e extraia todas as informações relevantes:" },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error("Error analyzing image:", error);
    return null;
  }
}

async function transcribeAudio(audioUrl: string, base64Data?: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;

  try {
    console.log("=== Starting audio transcription ===");
    
    let audioBlob: Blob;
    
    if (base64Data) {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      audioBlob = new Blob([bytes], { type: 'audio/ogg' });
    } else if (audioUrl) {
      const audioResponse = await fetch(audioUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!audioResponse.ok) return null;
      audioBlob = await audioResponse.blob();
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
    console.error("Error transcribing audio:", error);
    return null;
  }
}

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

async function findInstance(identifier: string, provider?: string) {
  console.log("Finding instance by identifier:", identifier, "provider:", provider);
  
  if (provider === "wasenderapi" || !provider) {
    // WasenderAPI sends the api_key as sessionId in webhooks
    const { data: wasenderByApiKey } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("wasender_api_key", identifier)
      .single();

    if (wasenderByApiKey) {
      console.log("Found instance by wasender_api_key:", wasenderByApiKey.id);
      return wasenderByApiKey;
    }

    const { data: wasenderInstance } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("wasender_session_id", identifier)
      .single();

    if (wasenderInstance) {
      console.log("Found instance by wasender_session_id:", wasenderInstance.id);
      return wasenderInstance;
    }

    const { data: byId } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", identifier)
      .single();

    if (byId) {
      console.log("Found instance by id:", byId.id);
      return byId;
    }
  }

  const { data: zapiInstance } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("z_api_instance_id", identifier)
    .single();

  if (zapiInstance) {
    console.log("Found instance by z_api_instance_id:", zapiInstance.id);
    return zapiInstance;
  }

  console.error("Instance not found:", identifier);
  return null;
}

async function findLeadByPhone(organizationId: string, phone: string) {
  const normalizedPhone = normalizePhone(phone);
  
  const variants = [
    normalizedPhone,
    normalizedPhone.replace("55", ""),
    normalizedPhone.length === 13 ? normalizedPhone.slice(0, 4) + normalizedPhone.slice(5) : null,
    normalizedPhone.length === 12 ? normalizedPhone.slice(0, 4) + "9" + normalizedPhone.slice(4) : null,
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

/**
 * Resolve or create contact by phone
 * Uses the new contacts/contact_identities system
 */
async function resolveOrCreateContact(
  organizationId: string,
  phone: string,
  name?: string
): Promise<string | null> {
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

    console.log("Contact resolved/created:", data, "for phone:", phone);
    return data;
  } catch (err) {
    console.error("Exception resolving contact:", err);
    return null;
  }
}

/**
 * Get or create conversation with proper phone handling for scale
 * Now includes contact resolution for 360 view
 * 
 * @param instanceId - The WhatsApp instance ID
 * @param organizationId - The tenant/organization ID
 * @param conversationPhone - The phone/JID used for conversation identification (may be LID)
 * @param sendablePhone - The actual phone number for sending messages (E.164 format)
 * @param contactName - Optional contact name
 * @param contactProfilePic - Optional profile picture URL
 */
async function getOrCreateConversation(
  instanceId: string,
  organizationId: string,
  conversationPhone: string,
  sendablePhone: string,
  contactName?: string,
  contactProfilePic?: string
) {
  // Resolve or create contact FIRST
  const phoneForContact = sendablePhone || conversationPhone;
  const contactId = await resolveOrCreateContact(organizationId, phoneForContact, contactName);
  
  console.log("Resolved contact_id:", contactId, "for phone:", phoneForContact);

  // Normalize phone for storage
  const customerPhoneE164 = normalizePhoneE164(phoneForContact);

  // Try to find existing conversation by instance + phone
  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("instance_id", instanceId)
    .eq("phone_number", conversationPhone)
    .single();

  if (existing) {
    // Update contact info, sendable_phone, and contact_id if needed
    const updates: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (contactName && !existing.contact_name) {
      updates.contact_name = contactName;
    }
    if (contactProfilePic && !existing.contact_profile_pic) {
      updates.contact_profile_pic = contactProfilePic;
    }
    // Always update sendable_phone if we have a better value
    if (sendablePhone && (!existing.sendable_phone || existing.sendable_phone !== sendablePhone)) {
      updates.sendable_phone = sendablePhone;
    }
    // Update contact_id if we now have one and didn't before
    if (contactId && !existing.contact_id) {
      updates.contact_id = contactId;
    }
    // Update customer_phone_e164
    if (customerPhoneE164 && existing.customer_phone_e164 !== customerPhoneE164) {
      updates.customer_phone_e164 = customerPhoneE164;
    }
    
    if (Object.keys(updates).length > 1) { // More than just updated_at
      await supabase
        .from("whatsapp_conversations")
        .update(updates)
        .eq("id", existing.id);
    }
    
    return { ...existing, contact_id: existing.contact_id || contactId };
  }

  // Try to find matching lead
  const lead = await findLeadByPhone(organizationId, sendablePhone || conversationPhone);

  // Create new conversation WITH contact_id
  const { data: newConversation, error } = await supabase
    .from("whatsapp_conversations")
    .insert({
      instance_id: instanceId,
      organization_id: organizationId,
      phone_number: conversationPhone,
      sendable_phone: sendablePhone || null,
      customer_phone_e164: customerPhoneE164,
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

  console.log("Created new conversation:", newConversation.id, "contact_id:", contactId, "sendable_phone:", sendablePhone);
  return newConversation;
}

async function messageExists(conversationId: string, messageId: string) {
  if (!messageId) return false;
  
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("z_api_message_id", messageId)
    .single();
  
  return !!data;
}

async function saveMessage(
  conversationId: string,
  instanceId: string,
  content: string | null,
  direction: "inbound" | "outbound",
  messageType: string,
  messageId?: string,
  mediaUrl?: string,
  mediaCaption?: string,
  isFromBot = false,
  contactId?: string | null
) {
  if (messageId && await messageExists(conversationId, messageId)) {
    console.log("Message already exists, skipping:", messageId);
    return null;
  }

  const { data, error } = await supabase
    .from("whatsapp_messages")
    .insert({
      conversation_id: conversationId,
      instance_id: instanceId,
      content,
      direction,
      message_type: messageType,
      z_api_message_id: messageId || null,
      media_url: mediaUrl || null,
      media_caption: mediaCaption || null,
      is_from_bot: isFromBot,
      status: direction === "outbound" ? "sent" : "delivered",
      contact_id: contactId || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving message:", error);
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

  await supabase
    .from("whatsapp_conversations")
    .update(updateData)
    .eq("id", conversationId);

  // Update contact last_activity_at
  if (contactId) {
    await supabase
      .from("contacts")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", contactId);
  }

  console.log("Message saved successfully:", data?.id, "contact_id:", contactId);
  return data;
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

async function processWasenderMessage(instance: any, body: any) {
  let msgData = body.data?.messages;
  
  if (Array.isArray(msgData)) {
    msgData = msgData[0];
  }
  if (!msgData) {
    msgData = body.data?.message || body.data;
  }
  
  if (!msgData) {
    console.log("No message data in payload");
    return null;
  }

  console.log("Processing msgData:", JSON.stringify(msgData, null, 2));

  const isFromMe = msgData.key?.fromMe === true;
  
  // Extract both conversation ID (for storage) and sendable phone (for replies)
  const { conversationId: phoneForConversation, sendablePhone } = extractPhoneFromWasenderPayload(msgData);
  
  if (!phoneForConversation && !sendablePhone) {
    console.log("No phone number in message, msgData keys:", Object.keys(msgData));
    return null;
  }
  
  // Extract message content
  let text = msgData.messageBody || 
            msgData.body ||
            msgData.text ||
            msgData.message?.conversation || 
            msgData.message?.extendedTextMessage?.text ||
            msgData.message?.imageMessage?.caption ||
            msgData.message?.videoMessage?.caption ||
            "";
  
  const messageId = msgData.key?.id || msgData.id || msgData.messageId || "";
  const remoteJid = msgData.key?.remoteJid || msgData.remoteJid || "";
  const isGroup = remoteJid.includes("@g.us") || msgData.isGroup || false;
  const senderName = msgData.pushName || msgData.senderName || msgData.name || "";
  
  // Determine message type
  let messageType = "text";
  if (msgData.message?.imageMessage || msgData.type === "image") messageType = "image";
  else if (msgData.message?.audioMessage || msgData.type === "audio" || msgData.type === "ptt") messageType = "audio";
  else if (msgData.message?.videoMessage || msgData.type === "video") messageType = "video";
  else if (msgData.message?.documentMessage || msgData.type === "document") messageType = "document";
  else if (msgData.message?.stickerMessage) messageType = "sticker";
  
  let mediaUrl = msgData.mediaUrl || 
                msgData.message?.imageMessage?.url ||
                msgData.message?.audioMessage?.url ||
                msgData.message?.videoMessage?.url ||
                msgData.message?.documentMessage?.url ||
                null;
                
  const caption = msgData.message?.imageMessage?.caption || 
                 msgData.message?.videoMessage?.caption ||
                 msgData.caption || 
                 null;

  const base64Data = msgData.base64 || 
                     msgData.mediaBase64 || 
                     msgData.message?.imageMessage?.base64 ||
                     msgData.message?.audioMessage?.base64 ||
                     msgData.message?.videoMessage?.base64 ||
                     null;

  console.log("=== Parsed WasenderAPI message ===");
  console.log("ConversationPhone:", phoneForConversation);
  console.log("SendablePhone:", sendablePhone);
  console.log("Text preview:", text?.substring(0, 50));
  console.log("Sender:", senderName);
  console.log("Is from me:", isFromMe);
  console.log("Message type:", messageType);

  if (isGroup) {
    console.log("Group message, skipping...");
    return null;
  }

  // Process media for incoming messages
  let processedContent = text || caption || null;
  
  if (!isFromMe && (mediaUrl || base64Data)) {
    if (messageType === "image") {
      const imageAnalysis = await analyzeImage(mediaUrl || "", base64Data);
      if (imageAnalysis) {
        processedContent = processedContent 
          ? `${processedContent}\n\n📸 Análise da imagem:\n${imageAnalysis}`
          : `📸 Análise da imagem:\n${imageAnalysis}`;
      }
    }
    
    if (messageType === "audio") {
      const transcription = await transcribeAudio(mediaUrl || "", base64Data);
      if (transcription) {
        processedContent = processedContent
          ? `${processedContent}\n\n🎤 Transcrição do áudio:\n${transcription}`
          : `🎤 Transcrição do áudio:\n${transcription}`;
      }
    }
  }

  // Get or create conversation with BOTH phone formats
  const conversation = await getOrCreateConversation(
    instance.id,
    instance.organization_id,
    phoneForConversation,
    sendablePhone,
    senderName
  );

  // Save the message
  const direction = isFromMe ? "outbound" : "inbound";
  const savedMessage = await saveMessage(
    conversation.id,
    instance.id,
    processedContent,
    direction,
    messageType,
    messageId,
    mediaUrl,
    caption,
    false,
    conversation.contact_id
  );

  console.log("WasenderAPI message processed:", {
    conversationId: conversation.id,
    sendablePhone,
    direction,
    saved: !!savedMessage,
  });

  // Generate AI response for incoming messages if bot is enabled
  if (!isFromMe && savedMessage && processedContent) {
    try {
      const { data: botConfig } = await supabase
        .from("whatsapp_bot_configs")
        .select("is_enabled")
        .eq("instance_id", instance.id)
        .single();

      console.log("Bot config:", botConfig);

      if (botConfig?.is_enabled) {
        const conversationHistory = await getConversationHistory(conversation.id, 20);
        
        let leadInfo = null;
        if (conversation.lead_id) {
          const { data: lead } = await supabase
            .from("leads")
            .select("name, stage, products")
            .eq("id", conversation.lead_id)
            .single();
          leadInfo = lead;
        }

        const aiResponse = await generateAIResponse(conversationHistory, processedContent, leadInfo);

        if (aiResponse) {
          // Use sendable_phone for actually sending the reply
          const phoneToSend = conversation.sendable_phone || sendablePhone;
          const formattedPhone = phoneToSend.startsWith("+") ? phoneToSend : `+${phoneToSend}`;
          
          const apiKey = instance.wasender_api_key;
          if (apiKey && phoneToSend) {
            const sendResponse = await fetch("https://www.wasenderapi.com/api/send-message", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: formattedPhone,
                text: aiResponse,
              }),
            });

            if (sendResponse.ok) {
              const sendData = await sendResponse.json();
              console.log("AI response sent successfully");
              
              await saveMessage(
                conversation.id,
                instance.id,
                aiResponse,
                "outbound",
                "text",
                sendData.data?.key?.id || undefined,
                undefined,
                undefined,
                true,
                conversation.contact_id
              );
            } else {
              console.error("Failed to send AI response:", await sendResponse.text());
            }
          }
        }
      } else {
        console.log("Bot not enabled for this instance");
      }
    } catch (error) {
      console.error("Error generating/sending AI response:", error);
    }
  }

  return { conversationId: conversation.id, saved: !!savedMessage };
}

async function processZapiMessage(instance: any, body: any) {
  const phone = body.phone?.replace("@c.us", "").replace("@s.whatsapp.net", "") || "";
  const text = body.text?.message || body.text || body.message || "";
  const messageId = body.messageId || body.ids?.[0] || "";
  const isFromMe = body.fromMe === true;
  const senderName = body.senderName || body.pushName || "";
  const isGroup = body.isGroup === true;

  if (!phone) {
    console.log("No phone number in Z-API message");
    return null;
  }

  if (isGroup) {
    console.log("Group message, skipping...");
    return null;
  }

  // For Z-API, phone is already the real phone number
  const conversation = await getOrCreateConversation(
    instance.id,
    instance.organization_id,
    phone,
    phone, // Same for Z-API since it uses real phones
    senderName
  );

  const direction = isFromMe ? "outbound" : "inbound";
  const savedMessage = await saveMessage(
    conversation.id,
    instance.id,
    text,
    direction,
    "text",
    messageId,
    undefined,
    undefined,
    false,
    conversation.contact_id
  );

  console.log("Z-API message processed:", {
    conversationId: conversation.id,
    direction,
    saved: !!savedMessage,
  });

  return { conversationId: conversation.id, saved: !!savedMessage };
}

async function handleMessageStatusUpdate(instance: any, body: any) {
  let messageId = "";
  let status = "";

  // WasenderAPI format
  if (body.data?.key?.id) {
    messageId = body.data.key.id;
    const statusCode = body.data.status;
    if (statusCode === 2) status = "sent";
    else if (statusCode === 3) status = "delivered";
    else if (statusCode === 4 || statusCode === 5) status = "read";
  }
  // Z-API format
  else if (body.ids?.[0]) {
    messageId = body.ids[0];
    status = body.status || body.ack;
  }

  if (!messageId || !status) {
    console.log("Invalid status update payload");
    return;
  }

  const { error } = await supabase
    .from("whatsapp_messages")
    .update({ status })
    .eq("z_api_message_id", messageId);

  if (!error) {
    console.log("Message status updated:", messageId, status);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    console.log("=== WhatsApp Multiattendant Webhook ===");
    console.log("Payload:", JSON.stringify(body, null, 2));

    // Detect provider from payload structure
    let provider = "";
    let instanceIdentifier = "";
    
    // WasenderAPI detection
    if (body.sessionId || body.data?.sessionId) {
      provider = "wasenderapi";
      instanceIdentifier = body.sessionId || body.data?.sessionId;
      console.log("WasenderAPI webhook detected - sessionId (api_key):", instanceIdentifier);
    }
    // Z-API detection
    else if (body.instanceId) {
      provider = "zapi";
      instanceIdentifier = body.instanceId;
      console.log("Z-API webhook detected - instanceId:", instanceIdentifier);
    }
    else {
      console.log("Unknown webhook format");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Provider detected:", provider);
    console.log("Instance identifier:", instanceIdentifier);
    console.log("Finding instance by identifier:", instanceIdentifier, "provider:", provider);

    // Find instance
    const instance = await findInstance(instanceIdentifier, provider);
    
    if (!instance) {
      console.error("Instance not found for:", instanceIdentifier);
      return new Response(JSON.stringify({ success: false, error: "Instance not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Instance found:", instance.name, instance.id, "provider:", instance.provider);

    // Handle based on event type
    const event = body.event || body.type || "";
    console.log("WasenderAPI event:", event);

    if (event === "messages.received" || event === "messages.upsert" || event === "ReceivedCallback") {
      if (provider === "wasenderapi") {
        await processWasenderMessage(instance, body);
      } else if (provider === "zapi") {
        await processZapiMessage(instance, body);
      }
    } else if (event === "messages.update" || event === "MessageStatusCallback") {
      await handleMessageStatusUpdate(instance, body);
    } else if (event === "connection.update") {
      // Handle connection status updates
      const status = body.data?.state || body.data?.connection;
      const isConnected = status === "open" || status === "connected";
      
      await supabase
        .from("whatsapp_instances")
        .update({ 
          is_connected: isConnected,
          status: isConnected ? "connected" : "disconnected",
          updated_at: new Date().toISOString()
        })
        .eq("id", instance.id);
        
      console.log("Connection status updated:", status);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
