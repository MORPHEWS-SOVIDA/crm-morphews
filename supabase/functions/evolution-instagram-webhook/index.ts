import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// INSTAGRAM WEBHOOK HANDLER
// Processa eventos de DM do Instagram via Evolution API
// ============================================================================

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const instanceName = body?.instance || body?.instanceName || "";
    const event = body?.event || "";

    console.log("Instagram Webhook received:", {
      event,
      instanceName,
      hasData: !!body?.data,
    });

    // Buscar instância pelo evolution_instance_id
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id, organization_id, name, channel_type")
      .eq("evolution_instance_id", instanceName)
      .eq("channel_type", "instagram")
      .single();

    if (!instance) {
      console.warn("Instagram instance not found:", instanceName);
      return new Response(JSON.stringify({ ok: true, message: "Instance not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = instance.organization_id;
    const instanceId = instance.id;

    // ==========================================
    // MESSAGES_UPSERT - Nova mensagem recebida
    // ==========================================
    if (event === "MESSAGES_UPSERT" || event === "messages.upsert") {
      const messagesData = body?.data || [];
      const messages = Array.isArray(messagesData) ? messagesData : [messagesData];

      for (const msgData of messages) {
        const key = msgData?.key || {};
        const remoteJid = key?.remoteJid || "";
        const fromMe = key?.fromMe || false;
        const messageId = key?.id || "";
        
        // Extrair ID do usuário Instagram (sem sufixo)
        const instagramUserId = remoteJid.split("@")[0];
        
        // Extrair conteúdo da mensagem
        const message = msgData?.message || {};
        const textContent = 
          message?.conversation ||
          message?.extendedTextMessage?.text ||
          message?.imageMessage?.caption ||
          message?.videoMessage?.caption ||
          "";
        
        const pushName = msgData?.pushName || "";
        const messageTimestamp = msgData?.messageTimestamp 
          ? new Date(parseInt(msgData.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString();

        console.log("Processing Instagram message:", {
          instagramUserId,
          fromMe,
          textContent: textContent.substring(0, 50),
          pushName,
        });

        // Verificar/criar conversa
        let { data: conversation } = await supabase
          .from("whatsapp_conversations")
          .select("id, lead_id, status, assigned_user_id")
          .eq("instance_id", instanceId)
          .eq("phone_number", instagramUserId)
          .single();

        if (!conversation) {
          // Criar nova conversa para Instagram
          const { data: newConv, error: createError } = await supabase
            .from("whatsapp_conversations")
            .insert({
              organization_id: organizationId,
              instance_id: instanceId,
              phone_number: instagramUserId,
              contact_name: pushName || `Instagram ${instagramUserId}`,
              sendable_phone: instagramUserId,
              chat_id: remoteJid,
              status: "pending",
              unread_count: fromMe ? 0 : 1,
              last_message_at: messageTimestamp,
              channel_type: "instagram",
            })
            .select()
            .single();

          if (createError) {
            console.error("Error creating Instagram conversation:", createError);
            continue;
          }
          conversation = newConv;
        } else if (!fromMe) {
          // Atualizar conversa existente
          await supabase
            .from("whatsapp_conversations")
            .update({
              unread_count: (conversation as any).unread_count + 1,
              last_message_at: messageTimestamp,
              status: (conversation as any).status === "closed" ? "pending" : (conversation as any).status,
            })
            .eq("id", conversation.id);
        }

        // Determinar tipo de mensagem
        let messageType = "text";
        let mediaUrl = null;
        let mediaFilename = null;

        if (message?.imageMessage) {
          messageType = "image";
          mediaUrl = message.imageMessage.url || null;
          mediaFilename = message.imageMessage.fileName || "image.jpg";
        } else if (message?.videoMessage) {
          messageType = "video";
          mediaUrl = message.videoMessage.url || null;
          mediaFilename = message.videoMessage.fileName || "video.mp4";
        } else if (message?.audioMessage) {
          messageType = "audio";
          mediaUrl = message.audioMessage.url || null;
          mediaFilename = message.audioMessage.fileName || "audio.ogg";
        } else if (message?.stickerMessage) {
          messageType = "sticker";
          mediaUrl = message.stickerMessage.url || null;
        }

        if (!conversation) {
          console.error("Failed to get conversation for message");
          continue;
        }

        // Inserir mensagem
        const { error: msgError } = await supabase
          .from("whatsapp_messages")
          .insert({
            organization_id: organizationId,
            instance_id: instanceId,
            conversation_id: conversation.id,
            message_id: messageId,
            from_number: fromMe ? "me" : instagramUserId,
            to_number: fromMe ? instagramUserId : "me",
            contact_name: pushName,
            message_type: messageType,
            text_content: textContent,
            media_url: mediaUrl,
            media_filename: mediaFilename,
            is_from_me: fromMe,
            status: fromMe ? "sent" : "received",
            timestamp: messageTimestamp,
            raw_payload: msgData,
          });

        if (msgError) {
          console.error("Error saving Instagram message:", msgError);
        } else {
          console.log("Instagram message saved successfully:", messageId);
        }
      }

      return new Response(JSON.stringify({ ok: true, processed: messages.length }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // CONNECTION_UPDATE - Status da conexão
    // ==========================================
    if (event === "CONNECTION_UPDATE" || event === "connection.update") {
      const state = body?.data?.state || body?.data?.status || "";
      const isConnected = state === "open" || state === "connected";

      console.log("Instagram connection update:", { instanceName, state, isConnected });

      await supabase
        .from("whatsapp_instances")
        .update({
          is_connected: isConnected,
          status: isConnected ? "connected" : "disconnected",
        })
        .eq("id", instanceId);

      return new Response(JSON.stringify({ ok: true, state }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // MESSAGES_UPDATE - Atualização de status
    // ==========================================
    if (event === "MESSAGES_UPDATE" || event === "messages.update") {
      const updates = Array.isArray(body?.data) ? body.data : [body?.data];

      for (const update of updates) {
        const messageId = update?.key?.id;
        const status = update?.update?.status;

        if (messageId && status) {
          const statusMap: Record<number, string> = {
            1: "pending",
            2: "sent",
            3: "delivered",
            4: "read",
            5: "played",
          };

          await supabase
            .from("whatsapp_messages")
            .update({ status: statusMap[status] || "unknown" })
            .eq("message_id", messageId)
            .eq("instance_id", instanceId);
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Evento não processado
    console.log("Unhandled Instagram event:", event);
    return new Response(JSON.stringify({ ok: true, event, skipped: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("evolution-instagram-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
