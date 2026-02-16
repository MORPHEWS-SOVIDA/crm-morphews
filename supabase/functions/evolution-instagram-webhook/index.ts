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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// INSTAGRAM WEBHOOK HANDLER (FULL)
// Processa DMs do Instagram via Evolution API com:
// - Criação/atualização de conversas
// - Vinculação automática a leads (por username)
// - Distribuição (manual/auto/bot)
// - Trigger de bot IA
// - Log de métricas
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const instanceName = body?.instance || body?.instanceName || "";
    const event = body?.event || "";

    console.log("📸 Instagram Webhook:", { event, instanceName, hasData: !!body?.data });

    // Buscar instância
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id, organization_id, name, channel_type, distribution_mode")
      .eq("evolution_instance_id", instanceName)
      .eq("channel_type", "instagram")
      .single();

    if (!instance) {
      console.warn("📸 Instagram instance not found:", instanceName);
      return new Response(JSON.stringify({ ok: true, message: "Instance not found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = instance.organization_id;
    const instanceId = instance.id;

    // ==========================================
    // CONNECTION_UPDATE
    // ==========================================
    if (event === "CONNECTION_UPDATE" || event === "connection.update") {
      const state = body?.data?.state || body?.data?.status || "";
      const isConnected = state === "open" || state === "connected";

      console.log("📸 Instagram connection:", { instanceName, state, isConnected });

      await supabase
        .from("whatsapp_instances")
        .update({ is_connected: isConnected, status: isConnected ? "active" : "disconnected", updated_at: new Date().toISOString() })
        .eq("id", instanceId);

      return new Response(JSON.stringify({ ok: true, state }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // MESSAGES_UPSERT - Nova mensagem
    // ==========================================
    if (event === "MESSAGES_UPSERT" || event === "messages.upsert") {
      const messagesData = body?.data || [];
      const messages = Array.isArray(messagesData) ? messagesData : [messagesData];

      for (const msgData of messages) {
        const key = msgData?.key || {};
        const remoteJid = key?.remoteJid || "";
        const fromMe = key?.fromMe || false;
        const messageId = key?.id || "";

        // Ignorar mensagens enviadas por nós
        if (fromMe) {
          console.log("📸 Skipping fromMe message");
          continue;
        }

        const instagramUserId = remoteJid.split("@")[0];
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

        console.log("📸 Processing Instagram message:", {
          instagramUserId,
          textContent: textContent.substring(0, 50),
          pushName,
        });

        // =========================
        // BUSCAR BOT CONFIGURADO
        // =========================
        let anyBotId: string | null = null;
        let activeBotId: string | null = null;

        const { data: anyBotResult } = await supabase.rpc('get_any_bot_for_instance', { p_instance_id: instanceId });
        if (anyBotResult) anyBotId = anyBotResult;

        const { data: activeBotResult } = await supabase.rpc('get_active_bot_for_instance', { p_instance_id: instanceId });
        if (activeBotResult) activeBotId = activeBotResult;

        console.log("📸 Bot config:", { anyBotId, activeBotId, distribution: instance.distribution_mode });

        // =========================
        // BUSCAR/CRIAR CONVERSA
        // =========================
        let { data: conversation } = await supabase
          .from("whatsapp_conversations")
          .select("id, lead_id, status, assigned_user_id, unread_count, awaiting_satisfaction_response, organization_id")
          .eq("organization_id", organizationId)
          .eq("instance_id", instanceId)
          .eq("phone_number", instagramUserId)
          .maybeSingle();

        let wasClosed = false;
        const distributionMode = instance.distribution_mode || 'manual';

        if (!conversation) {
          // Criar nova conversa
          const displayName = pushName || `@${instagramUserId}`;

          const insertData: any = {
            organization_id: organizationId,
            instance_id: instanceId,
            current_instance_id: instanceId,
            phone_number: instagramUserId,
            contact_name: displayName,
            display_name: displayName,
            sendable_phone: instagramUserId,
            chat_id: remoteJid,
            status: "pending",
            unread_count: 1,
            last_message_at: messageTimestamp,
            last_customer_message_at: messageTimestamp,
            channel_type: "instagram",
          };

          const { data: newConv, error: createError } = await supabase
            .from("whatsapp_conversations")
            .insert(insertData)
            .select("id, lead_id, status, assigned_user_id, unread_count, organization_id")
            .single();

          if (createError) {
            console.error("📸 Error creating conversation:", createError);
            continue;
          }
          conversation = newConv;
          console.log("📸 Created new Instagram conversation:", newConv.id);

          // =====================
          // AUTO-LINK LEAD BY INSTAGRAM USERNAME
          // =====================
          const igUsername = pushName || instagramUserId;
          const { data: matchedLead } = await supabase
            .from("leads")
            .select("id, name, whatsapp, funnel_stage_id")
            .eq("organization_id", organizationId)
            .or(`instagram.eq.${igUsername},instagram.eq.@${igUsername}`)
            .limit(1)
            .maybeSingle();

          if (matchedLead) {
            console.log("📸 Auto-linked to lead:", matchedLead.id, matchedLead.name);
            await supabase
              .from("whatsapp_conversations")
              .update({ lead_id: matchedLead.id })
              .eq("id", conversation.id);

            // Log the link
            await supabase.from("conversation_lead_links").insert({
              organization_id: organizationId,
              conversation_id: conversation.id,
              lead_id: matchedLead.id,
              channel_type: "instagram",
              linked_by: "auto_username",
              lead_name: matchedLead.name,
              instagram_username: igUsername,
              funnel_stage_at_link: matchedLead.funnel_stage_id,
            });

            conversation = { ...conversation, lead_id: matchedLead.id } as any;
          }

          // =====================
          // DISTRIBUTION MODE
          // =====================
          if (distributionMode === 'bot' && anyBotId) {
            console.log("📸 Bot mode enabled for Instagram conversation");
            await supabase
              .from("whatsapp_conversations")
              .update({
                status: 'with_bot',
                handling_bot_id: anyBotId,
                bot_started_at: new Date().toISOString(),
                bot_messages_count: 0,
              })
              .eq("id", conversation.id);
            conversation = { ...conversation, status: 'with_bot' } as any;
          } else if (distributionMode === 'auto') {
            const { data: assignResult } = await supabase.rpc('reopen_whatsapp_conversation', {
              p_conversation_id: conversation.id,
              p_instance_id: instanceId,
            });
            console.log("📸 Auto-distribution result:", assignResult);
          }

        } else {
          // Atualizar conversa existente
          wasClosed = conversation.status === 'closed';

          const updateData: any = {
            last_message_at: messageTimestamp,
            last_customer_message_at: messageTimestamp,
            unread_count: (conversation.unread_count || 0) + 1,
            chat_id: remoteJid,
            current_instance_id: instanceId,
          };

          if (pushName) {
            updateData.contact_name = pushName;
            updateData.display_name = pushName;
          }

          // Reabertura
          if (wasClosed) {
            if (distributionMode === 'bot' && anyBotId) {
              updateData.status = 'with_bot';
              updateData.handling_bot_id = anyBotId;
              updateData.bot_started_at = new Date().toISOString();
              updateData.bot_messages_count = 0;
              updateData.assigned_user_id = null;
              updateData.closed_at = null;
            } else if (distributionMode === 'auto') {
              await supabase.rpc('reopen_whatsapp_conversation', {
                p_conversation_id: conversation.id,
                p_instance_id: instanceId,
              });
            } else {
              updateData.status = 'pending';
              updateData.assigned_user_id = null;
              updateData.closed_at = null;
            }
          }

          await supabase.from("whatsapp_conversations").update(updateData).eq("id", conversation.id);
          conversation = { ...conversation, ...updateData } as any;
          console.log("📸 Updated conversation:", conversation.id, wasClosed ? "(reopened)" : "");
        }

        // =========================
        // DETECTAR TIPO DE MENSAGEM
        // =========================
        let messageType = "text";
        let mediaUrl: string | null = null;
        let mediaCaption: string | null = null;

        if (message?.imageMessage) {
          messageType = "image";
          mediaUrl = message.imageMessage.url || null;
          mediaCaption = message.imageMessage.caption || null;
        } else if (message?.videoMessage) {
          messageType = "video";
          mediaUrl = message.videoMessage.url || null;
          mediaCaption = message.videoMessage.caption || null;
        } else if (message?.audioMessage) {
          messageType = "audio";
          mediaUrl = message.audioMessage.url || null;
        } else if (message?.stickerMessage) {
          messageType = "sticker";
          mediaUrl = message.stickerMessage.url || null;
        }

        if (!conversation) continue;

        // =========================
        // SALVAR MENSAGEM
        // =========================
        const newMsgId = crypto.randomUUID();
        const { error: msgError } = await supabase
          .from("whatsapp_messages")
          .insert({
            id: newMsgId,
            instance_id: instanceId,
            conversation_id: conversation.id,
            message_type: messageType,
            content: textContent,
            media_url: mediaUrl,
            media_caption: mediaCaption,
            direction: "inbound",
            status: "delivered",
            is_from_bot: false,
            provider: "evolution",
            provider_message_id: messageId,
          });

        if (msgError) {
          console.error("📸 Error saving message:", msgError);
        } else {
          console.log("📸 Message saved:", newMsgId);

          // =========================
          // PROCESSAR COM BOT IA
          // =========================
          const botIdToUse = anyBotId;
          const isWithinSchedule = !!activeBotId;
          const supportedBotTypes = ['text', 'audio', 'image'];

          if (
            botIdToUse &&
            supportedBotTypes.includes(messageType) &&
            (conversation as any).status === 'with_bot'
          ) {
            console.log("📸🤖 Triggering AI bot for Instagram:", botIdToUse);

            const botPayload: any = {
              botId: botIdToUse,
              conversationId: conversation.id,
              instanceId: instanceId,
              instanceName: instanceName,
              organizationId: organizationId,
              userMessage: textContent || '',
              contactName: pushName || `@${instagramUserId}`,
              phoneNumber: instagramUserId,
              chatId: remoteJid,
              isFirstMessage: wasClosed,
              messageType: messageType,
              isWithinSchedule,
              channelType: 'instagram', // para o bot saber que é Instagram
            };

            if ((messageType === 'audio' || messageType === 'image') && mediaUrl) {
              botPayload.mediaUrl = mediaUrl;
            }

            // Fire and forget
            fetch(`${SUPABASE_URL}/functions/v1/ai-bot-process`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify(botPayload),
            }).then(async (res) => {
              const result = await res.json();
              console.log("📸🤖 Bot result:", result);
            }).catch((err) => {
              console.error("📸🤖 Bot error:", err);
            });
          }
        }
      }

      return new Response(JSON.stringify({ ok: true, processed: messages.length }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // MESSAGES_UPDATE - Status de mensagem
    // ==========================================
    if (event === "MESSAGES_UPDATE" || event === "messages.update") {
      const updates = Array.isArray(body?.data) ? body.data : [body?.data];
      for (const update of updates) {
        const msgId = update?.key?.id;
        const status = update?.update?.status;
        if (msgId && status) {
          const statusMap: Record<number, string> = { 1: "pending", 2: "sent", 3: "delivered", 4: "read", 5: "played" };
          await supabase
            .from("whatsapp_messages")
            .update({ status: statusMap[status] || "unknown" })
            .eq("provider_message_id", msgId)
            .eq("instance_id", instanceId);
        }
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("📸 Unhandled Instagram event:", event);
    return new Response(JSON.stringify({ ok: true, event, skipped: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("📸 evolution-instagram-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
