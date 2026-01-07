import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalizeWhatsApp(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (!clean.startsWith("55")) clean = `55${clean}`;
  if (clean.length === 12 && clean.startsWith("55")) {
    clean = clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
}

// Detectar tipo de mensagem baseado no conteúdo
function detectMessageType(message: any): { type: string; content: string; mediaUrl: string | null; mediaCaption: string | null; mediaMimeType: string | null } {
  // Texto simples
  if (message?.conversation) {
    return { type: "text", content: message.conversation, mediaUrl: null, mediaCaption: null, mediaMimeType: null };
  }
  
  // Texto estendido
  if (message?.extendedTextMessage?.text) {
    return { type: "text", content: message.extendedTextMessage.text, mediaUrl: null, mediaCaption: null, mediaMimeType: null };
  }

  // Imagem
  if (message?.imageMessage) {
    const img = message.imageMessage;
    const mediaUrl = img.url || img.directPath || null;
    const base64 = img.base64 || null;
    const caption = img.caption || "";
    const mimeType = img.mimetype || "image/jpeg";
    
    return { 
      type: "image", 
      content: caption, 
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : mediaUrl,
      mediaCaption: caption,
      mediaMimeType: mimeType
    };
  }

  // Áudio
  if (message?.audioMessage) {
    const audio = message.audioMessage;
    const mediaUrl = audio.url || audio.directPath || null;
    const base64 = audio.base64 || null;
    const mimeType = audio.mimetype || "audio/ogg";
    
    return { 
      type: "audio", 
      content: "", 
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : mediaUrl,
      mediaCaption: null,
      mediaMimeType: mimeType
    };
  }

  // Vídeo
  if (message?.videoMessage) {
    const video = message.videoMessage;
    const mediaUrl = video.url || video.directPath || null;
    const base64 = video.base64 || null;
    const caption = video.caption || "";
    const mimeType = video.mimetype || "video/mp4";
    
    return { 
      type: "video", 
      content: caption, 
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : mediaUrl,
      mediaCaption: caption,
      mediaMimeType: mimeType
    };
  }

  // Documento
  if (message?.documentMessage) {
    const doc = message.documentMessage;
    const mediaUrl = doc.url || doc.directPath || null;
    const base64 = doc.base64 || null;
    const caption = doc.caption || doc.fileName || "";
    const mimeType = doc.mimetype || "application/octet-stream";
    
    return { 
      type: "document", 
      content: caption, 
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : mediaUrl,
      mediaCaption: caption,
      mediaMimeType: mimeType
    };
  }

  // Sticker
  if (message?.stickerMessage) {
    const sticker = message.stickerMessage;
    const base64 = sticker.base64 || null;
    const mimeType = sticker.mimetype || "image/webp";
    
    return { 
      type: "sticker", 
      content: "", 
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : null,
      mediaCaption: null,
      mediaMimeType: mimeType
    };
  }

  // Localização
  if (message?.locationMessage) {
    const loc = message.locationMessage;
    const coords = `${loc.degreesLatitude},${loc.degreesLongitude}`;
    const content = loc.name ? `📍 ${loc.name}\n${coords}` : `📍 Localização: ${coords}`;
    
    return { type: "location", content, mediaUrl: null, mediaCaption: null, mediaMimeType: null };
  }

  // Contato
  if (message?.contactMessage) {
    const contact = message.contactMessage;
    const content = `👤 Contato: ${contact.displayName || "Sem nome"}`;
    
    return { type: "contact", content, mediaUrl: null, mediaCaption: null, mediaMimeType: null };
  }

  // Reação
  if (message?.reactionMessage) {
    return { type: "reaction", content: message.reactionMessage.text || "👍", mediaUrl: null, mediaCaption: null, mediaMimeType: null };
  }

  // Fallback
  return { type: "text", content: "[Mensagem não suportada]", mediaUrl: null, mediaCaption: null, mediaMimeType: null };
}

// Salvar mídia no storage se vier como base64
async function saveMediaToStorage(
  organizationId: string,
  instanceId: string,
  conversationId: string,
  mediaUrl: string | null,
  mimeType: string | null
): Promise<string | null> {
  if (!mediaUrl) return null;
  
  // Se não for base64, retorna a URL direta
  if (!mediaUrl.startsWith("data:")) {
    return mediaUrl;
  }

  try {
    // Parse base64
    const matches = mediaUrl.match(/^data:(.+);base64,(.*)$/);
    if (!matches) return mediaUrl;

    const mime = matches[1];
    const base64Data = matches[2];
    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    // Determinar extensão
    let ext = "bin";
    if (mime.includes("jpeg") || mime.includes("jpg")) ext = "jpg";
    else if (mime.includes("png")) ext = "png";
    else if (mime.includes("webp")) ext = "webp";
    else if (mime.includes("gif")) ext = "gif";
    else if (mime.includes("ogg")) ext = "ogg";
    else if (mime.includes("mp3") || mime.includes("mpeg")) ext = "mp3";
    else if (mime.includes("mp4")) ext = "mp4";
    else if (mime.includes("pdf")) ext = "pdf";
    else if (mime.includes("wav")) ext = "wav";
    else if (mime.includes("m4a")) ext = "m4a";
    else if (mime.includes("webm")) ext = "webm";

    const timestamp = Date.now();
    const random = crypto.randomUUID().split("-")[0];
    const storagePath = `orgs/${organizationId}/instances/${instanceId}/${conversationId}/${timestamp}_${random}.${ext}`;

    console.log("📤 Saving inbound media to storage:", { storagePath, size: bytes.length });

    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(storagePath, bytes, {
        contentType: mime,
        upsert: true,
      });

    if (uploadError) {
      console.error("❌ Media upload failed:", uploadError);
      return null;
    }

    // Gerar URL pública assinada
    const { data: signedData } = await supabase.storage
      .from("whatsapp-media")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 ano

    console.log("✅ Media saved:", signedData?.signedUrl?.substring(0, 60));
    return signedData?.signedUrl || null;
  } catch (error) {
    console.error("❌ Error saving media:", error);
    return null;
  }
}

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
        // Buscar instância pelo evolution_instance_id
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("id, organization_id")
          .eq("evolution_instance_id", instanceName)
          .single();

        if (instance) {
          // Atualizar status
          const updateData: any = {
            is_connected: isConnected,
            status: isConnected ? "connected" : state,
            updated_at: new Date().toISOString(),
          };

          // Se desconectou, limpar QR code
          if (!isConnected) {
            updateData.qr_code_base64 = null;
          }

          await supabase
            .from("whatsapp_instances")
            .update(updateData)
            .eq("id", instance.id);

          console.log("Instance status updated:", { instanceId: instance.id, isConnected });
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
            status: "waiting_qr",
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

      // Extrair telefone do remetente
      const remoteJid = key?.remoteJid || "";
      const isFromMe = key?.fromMe === true;
      const isGroup = remoteJid.includes("@g.us");

      // Ignorar mensagens próprias e de grupos (por enquanto)
      if (isFromMe || isGroup) {
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fromPhoneRaw = remoteJid.split("@")[0] || "";
      const fromPhone = normalizeWhatsApp(fromPhoneRaw);

      // Detectar tipo de mensagem e extrair conteúdo
      const msgData = detectMessageType(message);

      console.log("Message received:", {
        instanceName,
        fromPhone,
        pushName,
        type: msgData.type,
        hasMedia: !!msgData.mediaUrl,
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

      // Buscar ou criar conversa
      let { data: conversation } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("instance_id", instance.id)
        .eq("phone_number", fromPhone)
        .single();

      if (!conversation) {
        const { data: newConvo, error: convoError } = await supabase
          .from("whatsapp_conversations")
          .insert({
            organization_id: organizationId,
            instance_id: instance.id,
            phone_number: fromPhone,
            sendable_phone: fromPhone,
            customer_phone_e164: fromPhone,
            contact_name: pushName || `+${fromPhone}`,
            chat_id: remoteJid, // Salvar JID para envio
            last_message_at: new Date().toISOString(),
            unread_count: 1,
          })
          .select()
          .single();

        if (convoError) {
          console.error("Error creating conversation:", convoError);
        } else {
          conversation = newConvo;
        }
      } else {
        // Atualizar conversa existente - incrementar unread_count
        const { data: currentConvo } = await supabase
          .from("whatsapp_conversations")
          .select("unread_count")
          .eq("id", conversation.id)
          .single();

        await supabase
          .from("whatsapp_conversations")
          .update({
            last_message_at: new Date().toISOString(),
            unread_count: (currentConvo?.unread_count || 0) + 1,
            chat_id: remoteJid,
          })
          .eq("id", conversation.id);
      }

      // Processar mídia se houver
      let savedMediaUrl: string | null = null;
      if (conversation && msgData.mediaUrl) {
        savedMediaUrl = await saveMediaToStorage(
          organizationId,
          instance.id,
          conversation.id,
          msgData.mediaUrl,
          msgData.mediaMimeType
        );
      }

      // Salvar mensagem
      if (conversation) {
        const waMessageId = key?.id || null;
        const messageId = crypto.randomUUID(); // Sempre gerar UUID válido

        const { error: msgError } = await supabase
          .from("whatsapp_messages")
          .insert({
            id: messageId,
            organization_id: organizationId,
            instance_id: instance.id,
            conversation_id: conversation.id,
            message_type: msgData.type,
            content: msgData.content,
            media_url: savedMediaUrl,
            media_caption: msgData.mediaCaption,
            is_from_me: false,
            direction: "inbound",
            status: "received",
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
            hasMedia: !!savedMediaUrl
          });
        }

        console.log("Message saved:", { 
          messageId, 
          conversationId: conversation.id,
          type: msgData.type,
          hasMedia: !!savedMediaUrl
        });
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
