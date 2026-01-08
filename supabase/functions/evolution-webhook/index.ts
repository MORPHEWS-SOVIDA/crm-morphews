import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const WHATSAPP_MEDIA_TOKEN_SECRET = Deno.env.get("WHATSAPP_MEDIA_TOKEN_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Normaliza telefone brasileiro para SEMPRE ter 55 + DD + 9 + 8 dígitos (para celular)
function normalizeWhatsApp(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (!clean.startsWith("55")) clean = `55${clean}`;
  // Se tem 12 dígitos (55 + DD + 8), adiciona o 9 (celular)
  if (clean.length === 12 && clean.startsWith("55")) {
    clean = clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
}

// Gera variações de um telefone brasileiro (com e sem o 9)
// Útil para buscar conversas onde o número pode ter sido salvo de forma diferente
function getBrazilPhoneVariations(phone: string): string[] {
  const normalized = normalizeWhatsApp(phone);
  if (!normalized) return [];
  
  const variations: string[] = [normalized];
  
  // Se tem 13 dígitos (55 + DD + 9 + 8), criar versão sem o 9
  if (normalized.length === 13 && normalized.startsWith("55")) {
    const without9 = normalized.slice(0, 4) + normalized.slice(5);
    variations.push(without9);
  }
  
  return variations;
}

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

async function generateMediaProxyUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60 * 24 * 365, // 1 year
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
// MESSAGE TYPE DETECTION
// ============================================================================

function detectMessageType(message: any): { 
  type: string; 
  content: string; 
  mediaUrl: string | null; 
  mediaCaption: string | null; 
  mediaMimeType: string | null;
  hasEncryptedMedia: boolean;
} {
  // Texto simples
  if (message?.conversation) {
    return { type: "text", content: message.conversation, mediaUrl: null, mediaCaption: null, mediaMimeType: null, hasEncryptedMedia: false };
  }
  
  // Texto estendido
  if (message?.extendedTextMessage?.text) {
    return { type: "text", content: message.extendedTextMessage.text, mediaUrl: null, mediaCaption: null, mediaMimeType: null, hasEncryptedMedia: false };
  }

  // Imagem
  if (message?.imageMessage) {
    const img = message.imageMessage;
    const base64 = img.base64 || null;
    const caption = img.caption || "";
    const mimeType = img.mimetype || "image/jpeg";
    // Se tem base64 já no payload, usa direto; senão marca para buscar
    const hasEncrypted = !base64 && (img.url || img.directPath);
    
    return { 
      type: "image", 
      content: caption, 
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : null,
      mediaCaption: caption,
      mediaMimeType: mimeType,
      hasEncryptedMedia: hasEncrypted
    };
  }

  // Áudio
  if (message?.audioMessage) {
    const audio = message.audioMessage;
    const base64 = audio.base64 || null;
    const mimeType = audio.mimetype || "audio/ogg";
    const hasEncrypted = !base64 && (audio.url || audio.directPath);
    
    return { 
      type: "audio", 
      content: "", 
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : null,
      mediaCaption: null,
      mediaMimeType: mimeType,
      hasEncryptedMedia: hasEncrypted
    };
  }

  // Vídeo
  if (message?.videoMessage) {
    const video = message.videoMessage;
    const base64 = video.base64 || null;
    const caption = video.caption || "";
    const mimeType = video.mimetype || "video/mp4";
    const hasEncrypted = !base64 && (video.url || video.directPath);
    
    return { 
      type: "video", 
      content: caption, 
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : null,
      mediaCaption: caption,
      mediaMimeType: mimeType,
      hasEncryptedMedia: hasEncrypted
    };
  }

  // Documento
  if (message?.documentMessage) {
    const doc = message.documentMessage;
    const base64 = doc.base64 || null;
    const caption = doc.caption || doc.fileName || "";
    const mimeType = doc.mimetype || "application/octet-stream";
    const hasEncrypted = !base64 && (doc.url || doc.directPath);
    
    return { 
      type: "document", 
      content: caption, 
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : null,
      mediaCaption: caption,
      mediaMimeType: mimeType,
      hasEncryptedMedia: hasEncrypted
    };
  }

  // Sticker
  if (message?.stickerMessage) {
    const sticker = message.stickerMessage;
    const base64 = sticker.base64 || null;
    const mimeType = sticker.mimetype || "image/webp";
    const hasEncrypted = !base64 && (sticker.url || sticker.directPath);
    
    return { 
      type: "sticker", 
      content: "", 
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : null,
      mediaCaption: null,
      mediaMimeType: mimeType,
      hasEncryptedMedia: hasEncrypted
    };
  }

  // Localização
  if (message?.locationMessage) {
    const loc = message.locationMessage;
    const coords = `${loc.degreesLatitude},${loc.degreesLongitude}`;
    const content = loc.name ? `📍 ${loc.name}\n${coords}` : `📍 Localização: ${coords}`;
    
    return { type: "location", content, mediaUrl: null, mediaCaption: null, mediaMimeType: null, hasEncryptedMedia: false };
  }

  // Contato
  if (message?.contactMessage) {
    const contact = message.contactMessage;
    const content = `👤 Contato: ${contact.displayName || "Sem nome"}`;
    
    return { type: "contact", content, mediaUrl: null, mediaCaption: null, mediaMimeType: null, hasEncryptedMedia: false };
  }

  // Reação
  if (message?.reactionMessage) {
    return { type: "reaction", content: message.reactionMessage.text || "👍", mediaUrl: null, mediaCaption: null, mediaMimeType: null, hasEncryptedMedia: false };
  }

  // Fallback
  return { type: "text", content: "[Mensagem não suportada]", mediaUrl: null, mediaCaption: null, mediaMimeType: null, hasEncryptedMedia: false };
}

// ============================================================================
// DOWNLOAD MEDIA FROM EVOLUTION API (getBase64FromMediaMessage)
// ============================================================================

async function downloadMediaFromEvolution(
  instanceName: string,
  messageKey: { id: string; remoteJid?: string; fromMe?: boolean },
  convertToMp4: boolean = false
): Promise<{ base64: string; mimeType: string } | null> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error("❌ Evolution API credentials not configured");
    return null;
  }

  try {
    const endpoint = `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${instanceName}`;
    
    console.log("📥 Fetching media from Evolution:", {
      instance: instanceName,
      messageId: messageKey.id,
      endpoint: endpoint.substring(0, 60) + "...",
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        message: {
          key: messageKey
        },
        convertToMp4: convertToMp4,
      }),
    });

    if (!response.ok) {
      console.error("❌ Evolution getBase64 failed:", response.status, await response.text().catch(() => ""));
      return null;
    }

    const result = await response.json();
    
    // Evolution returns { base64: "...", mimetype: "..." }
    if (result?.base64) {
      console.log("✅ Media downloaded from Evolution:", {
        hasBase64: true,
        mimeType: result.mimetype || "unknown",
        size: result.base64.length,
      });
      return {
        base64: result.base64,
        mimeType: result.mimetype || "application/octet-stream",
      };
    }

    console.log("⚠️ Evolution returned no base64:", Object.keys(result || {}));
    return null;
  } catch (error) {
    console.error("❌ Error downloading media from Evolution:", error);
    return null;
  }
}

// ============================================================================
// SAVE MEDIA TO STORAGE
// ============================================================================

function extFromMime(mime: string): string {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp3") || mime.includes("mpeg")) return "mp3";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("m4a")) return "m4a";
  if (mime.includes("webm")) return "webm";
  return "bin";
}

// Limpa o content-type removendo parâmetros como "; codecs=opus"
function cleanContentType(mime: string): string {
  const baseMime = mime.split(";")[0].trim();
  // Normalizar audio/ogg para ser compatível com browsers
  if (baseMime === "audio/ogg") return "audio/ogg";
  return baseMime;
}

async function saveMediaToStorage(
  organizationId: string,
  instanceId: string,
  conversationId: string,
  base64Data: string,
  mimeType: string
): Promise<string | null> {
  try {
    // Remove data URL prefix if present
    const base64Clean = base64Data.includes(",") 
      ? base64Data.split(",")[1] 
      : base64Data;
    
    const bytes = Uint8Array.from(atob(base64Clean), (c) => c.charCodeAt(0));
    const ext = extFromMime(mimeType);
    const timestamp = Date.now();
    const random = crypto.randomUUID().split("-")[0];
    const storagePath = `orgs/${organizationId}/instances/${instanceId}/${conversationId}/${timestamp}_${random}.${ext}`;

    // Limpar o mimeType para evitar problemas com "; codecs=opus"
    const cleanMimeType = cleanContentType(mimeType);
    
    console.log("📤 Saving inbound media to storage:", { storagePath, size: bytes.length, mimeType: cleanMimeType });

    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(storagePath, bytes, {
        contentType: cleanMimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("❌ Media upload failed:", uploadError);
      return null;
    }

    // Generate proxy URL (more secure than signed URL) - usar o mimeType limpo
    const proxyUrl = await generateMediaProxyUrl(storagePath, 60 * 60 * 24 * 365, cleanMimeType);
    console.log("✅ Media saved:", proxyUrl.substring(0, 80) + "...");
    return proxyUrl;
  } catch (error) {
    console.error("❌ Error saving media:", error);
    return null;
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
    const body = await req.json().catch(() => ({}));

    // Evolution envia o nome da instância no payload
    const instanceName = body?.instance || body?.instanceName || "";
    const event = body?.event || "";

    console.log("Evolution Webhook received:", {
      event,
      instanceName,
      topLevelKeys: Object.keys(body || {}).slice(0, 10),
    });

    // =====================
    // CONNECTION UPDATE
    // =====================
    if (event === "connection.update" || event === "CONNECTION_UPDATE") {
      const state = body?.data?.state || body?.state || "";
      const isConnected = state === "open";

      console.log("Connection update:", { instanceName, state, isConnected });

      if (instanceName) {
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("id, organization_id")
          .eq("evolution_instance_id", instanceName)
          .single();

        if (instance) {
          const updateData: any = {
            is_connected: isConnected,
            status: isConnected ? "active" : "disconnected",
            updated_at: new Date().toISOString(),
          };

          if (!isConnected) {
            updateData.qr_code_base64 = null;
          }

          await supabase
            .from("whatsapp_instances")
            .update(updateData)
            .eq("id", instance.id);

          console.log("Instance status updated:", { instanceId: instance.id, isConnected });

          // =====================
          // AUTO-ENABLE GROUPS ON CONNECT
          // =====================
          if (isConnected) {
            console.log("🔄 Auto-enabling groups for instance:", instanceName);
            
            // 1. Configurar settings para NÃO ignorar grupos
            try {
              const settingsRes = await fetch(`${EVOLUTION_API_URL}/settings/set/${instanceName}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": EVOLUTION_API_KEY,
                },
                body: JSON.stringify({
                  groupsIgnore: false,
                }),
              });
              console.log("✅ Groups settings configured:", await settingsRes.json().catch(() => ({})));
            } catch (e) {
              console.warn("⚠️ Could not configure groups settings:", e);
            }

            // 2. Garantir que webhook tem GROUPS_UPSERT
            try {
              const webhookUrl = `${SUPABASE_URL}/functions/v1/evolution-webhook`;
              const webhookRes = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": EVOLUTION_API_KEY,
                },
                body: JSON.stringify({
                  url: webhookUrl,
                  byEvents: false,
                  base64: true,
                  headers: { "Content-Type": "application/json" },
                  events: [
                    "MESSAGES_UPSERT",
                    "CONNECTION_UPDATE",
                    "QRCODE_UPDATED",
                    "GROUPS_UPSERT",
                  ],
                }),
              });
              console.log("✅ Webhook with groups configured:", await webhookRes.json().catch(() => ({})));
            } catch (e) {
              console.warn("⚠️ Could not configure webhook:", e);
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // QR CODE UPDATED
    // =====================
    if (event === "qrcode.updated" || event === "QRCODE_UPDATED") {
      const qrBase64 = body?.data?.qrcode?.base64 || body?.qrcode?.base64 || "";

      console.log("QR Code update:", { instanceName, hasQr: !!qrBase64 });

      if (instanceName && qrBase64) {
        await supabase
          .from("whatsapp_instances")
          .update({
            qr_code_base64: qrBase64,
            status: "pending",
            is_connected: false,
            updated_at: new Date().toISOString(),
          })
          .eq("evolution_instance_id", instanceName);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // MESSAGES UPSERT
    // =====================
    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const data = body?.data || body;
      const key = data?.key || {};
      const message = data?.message || {};
      const pushName = data?.pushName || "";

      const remoteJid = key?.remoteJid || "";
      const isFromMe = key?.fromMe === true;
      const isGroup = remoteJid.includes("@g.us");
      
      // Ignorar apenas mensagens próprias (não de grupos!)
      if (isFromMe) {
        return new Response(JSON.stringify({ success: true, ignored: true, reason: "fromMe" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extrair informações de grupo
      let groupSubject: string | null = null;
      let participantPhone: string | null = null;
      
      if (isGroup) {
        groupSubject = data?.groupMetadata?.subject || data?.groupSubject || null;
        // Em grupos, participant é quem enviou
        const participantJid = key?.participant || "";
        if (participantJid) {
          participantPhone = normalizeWhatsApp(participantJid.split("@")[0]);
        }
      }

      const fromPhoneRaw = isGroup 
        ? (participantPhone || remoteJid.split("@")[0])
        : remoteJid.split("@")[0];
      const fromPhone = normalizeWhatsApp(fromPhoneRaw);

      // Detectar tipo de mensagem e extrair conteúdo
      const msgData = detectMessageType(message);

      console.log("Message received:", {
        instanceName,
        fromPhone,
        pushName,
        type: msgData.type,
        isGroup,
        groupSubject,
        hasMedia: !!msgData.mediaUrl || msgData.hasEncryptedMedia,
        contentPreview: msgData.content.substring(0, 100),
      });

      // Buscar a instância para saber a organização
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("id, organization_id, phone_number")
        .eq("evolution_instance_id", instanceName)
        .single();

      if (!instance) {
        console.log("Instance not found:", instanceName);
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Atualizar phone_number da instância se ainda não tiver
      if (!instance.phone_number && body?.data?.owner) {
        const ownerPhone = normalizeWhatsApp(body.data.owner.split("@")[0]);
        if (ownerPhone) {
          await supabase
            .from("whatsapp_instances")
            .update({ phone_number: ownerPhone })
            .eq("id", instance.id);
        }
      }

      const organizationId = instance.organization_id;

      // Buscar conversa existente - PRIMEIRO por chat_id (mais confiável)
      // Depois tentar por phone_number com variações brasileiras (com/sem 9)
      let { data: conversation } = await supabase
        .from("whatsapp_conversations")
        .select("id, unread_count, instance_id, phone_number")
        .eq("organization_id", organizationId)
        .eq("chat_id", remoteJid)
        .maybeSingle();

      // Se não encontrou por chat_id, tentar por phone_number (para conversas criadas pelo frontend)
      // Usa variações do número brasileiro (com e sem o dígito 9)
      if (!conversation && !isGroup) {
        const phoneVariations = getBrazilPhoneVariations(fromPhone);
        console.log("Searching conversation by phone variations:", phoneVariations);
        
        for (const phoneVar of phoneVariations) {
          const { data: convByPhone } = await supabase
            .from("whatsapp_conversations")
            .select("id, unread_count, instance_id, phone_number")
            .eq("organization_id", organizationId)
            .eq("phone_number", phoneVar)
            .maybeSingle();
          
          if (convByPhone) {
            conversation = convByPhone;
            console.log("Found conversation by phone variation:", phoneVar, "original:", fromPhone);
            break;
          }
        }
      }

      if (!conversation) {
        // Criar nova conversa
        const displayName = isGroup 
          ? (groupSubject || `Grupo ${remoteJid.split("@")[0]}`)
          : (pushName || `+${fromPhone}`);
          
        const { data: newConvo, error: convoError } = await supabase
          .from("whatsapp_conversations")
          .insert({
            organization_id: organizationId,
            instance_id: instance.id,
            current_instance_id: instance.id,
            phone_number: isGroup ? remoteJid.split("@")[0] : fromPhone,
            sendable_phone: isGroup ? null : fromPhone,
            customer_phone_e164: isGroup ? null : fromPhone,
            contact_name: displayName,
            display_name: displayName,
            chat_id: remoteJid,
            is_group: isGroup,
            group_subject: groupSubject,
            last_message_at: new Date().toISOString(),
            unread_count: 1,
          })
          .select("id, unread_count, instance_id, phone_number")
          .single();

        if (convoError) {
          console.error("Error creating conversation:", convoError);
        } else {
          conversation = newConvo;
          console.log("Created new conversation:", { id: conversation?.id, isGroup, groupSubject });
        }
      } else {
        // Atualizar conversa existente
        const updateData: any = {
          last_message_at: new Date().toISOString(),
          unread_count: (conversation.unread_count || 0) + 1,
          chat_id: remoteJid,
          current_instance_id: instance.id,
        };
        
        // Atualizar phone_number se diferente (normalização brasileira)
        if (!isGroup && conversation.phone_number !== fromPhone) {
          updateData.phone_number = fromPhone;
          updateData.sendable_phone = fromPhone;
          updateData.customer_phone_e164 = fromPhone;
          console.log("Updating phone_number from", conversation.phone_number, "to", fromPhone);
        }
        
        if (isGroup && groupSubject) {
          updateData.group_subject = groupSubject;
          updateData.display_name = groupSubject;
        }

        await supabase
          .from("whatsapp_conversations")
          .update(updateData)
          .eq("id", conversation.id);

        console.log("Updated conversation:", conversation.id, "from instance:", instance.id);
      }

      // =====================
      // PROCESSAR MÍDIA
      // =====================
      let savedMediaUrl: string | null = null;
      
      if (conversation) {
        // Se já tem base64 no payload, salvar direto
        if (msgData.mediaUrl && msgData.mediaUrl.startsWith("data:")) {
          savedMediaUrl = await saveMediaToStorage(
            organizationId,
            instance.id,
            conversation.id,
            msgData.mediaUrl,
            msgData.mediaMimeType || "application/octet-stream"
          );
        }
        // Se tem mídia criptografada (mmg.whatsapp.net), buscar via Evolution API
        else if (msgData.hasEncryptedMedia && key?.id) {
          console.log("📥 Fetching encrypted media via Evolution API...");
          
          const mediaResult = await downloadMediaFromEvolution(
            instanceName,
            {
              id: key.id,
              remoteJid: remoteJid,
              fromMe: false,
            },
            msgData.type === "video" // Convert video to mp4
          );

          if (mediaResult?.base64) {
            savedMediaUrl = await saveMediaToStorage(
              organizationId,
              instance.id,
              conversation.id,
              mediaResult.base64,
              mediaResult.mimeType || msgData.mediaMimeType || "application/octet-stream"
            );
          }
        }
      }

      // Salvar mensagem
      if (conversation) {
        const waMessageId = key?.id || null;
        const messageId = crypto.randomUUID();

        // Conteúdo da mensagem (para grupos, incluir quem enviou)
        let messageContent = msgData.content;
        if (isGroup && pushName && msgData.type === "text") {
          // Opcional: prefixar com nome do remetente em grupos
          // messageContent = `[${pushName}] ${msgData.content}`;
        }

        const { error: msgError } = await supabase
          .from("whatsapp_messages")
          .insert({
            id: messageId,
            instance_id: instance.id,
            conversation_id: conversation.id,
            message_type: msgData.type,
            content: messageContent,
            media_url: savedMediaUrl,
            media_caption: msgData.mediaCaption,
            direction: "inbound",
            status: "delivered",
            is_from_bot: false,
            provider: "evolution",
            provider_message_id: waMessageId,
          });

        if (msgError) {
          console.error("Error saving message:", msgError);
        } else {
          console.log("Message saved:", {
            messageId,
            conversationId: conversation.id,
            type: msgData.type,
            isGroup,
            hasMedia: !!savedMediaUrl,
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Evento não tratado
    console.log("Unhandled event:", event);
    return new Response(JSON.stringify({ success: true, unhandled: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("evolution-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
