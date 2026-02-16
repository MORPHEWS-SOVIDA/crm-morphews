import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SENDPULSE_BOT_ID = "69933f61385f438108088939";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// SENDPULSE WEBHOOK HANDLER
// Processa DMs do Instagram via SendPulse com:
// - Criação/atualização de conversas (whatsapp_conversations)
// - Vinculação automática a leads (por username)
// - Distribuição (manual/auto/bot)
// - Trigger de bot IA
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // SendPulse sends an array of webhook events
    const events = Array.isArray(body) ? body : [body];

    let processed = 0;

    for (const event of events) {
      const service = event?.service || "";
      const title = event?.title || "";
      const contact = event?.contact || {};
      const bot = event?.bot || {};
      const info = event?.info || {};

      console.log("📸 SendPulse webhook:", { service, title, botId: bot?.id, contactId: contact?.id });

      // Only process Instagram incoming messages
      if (service !== "instagram") {
        console.log("📸 Skipping non-Instagram event:", service);
        continue;
      }

      if (title !== "incoming_message") {
        console.log("📸 Skipping non-message event:", title);
        continue;
      }

      const contactId = contact?.id || "";
      const contactName = contact?.name || contact?.username || "";
      const lastMessage = contact?.last_message || "";
      const contactPhoto = contact?.photo || null;
      const instagramUsername = contact?.username || contactId;

      if (!contactId || !lastMessage) {
        console.log("📸 Missing contactId or message, skipping");
        continue;
      }

      console.log("📸 Processing Instagram DM:", {
        contactId,
        contactName,
        message: lastMessage.substring(0, 50),
        username: instagramUsername,
      });

      // =========================
      // FIND OR CREATE INSTAGRAM INSTANCE
      // =========================
      let { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("id, organization_id, name, channel_type, distribution_mode")
        .eq("channel_type", "instagram")
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();

      if (!instance) {
        // Auto-create Instagram instance on first message
        // Find the organization that owns this bot (use the first org with active whatsapp instances)
        const { data: refInstance } = await supabase
          .from("whatsapp_instances")
          .select("organization_id")
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle();

        const orgId = refInstance?.organization_id;
        if (!orgId) {
          console.warn("📸 No organization found to create Instagram instance");
          continue;
        }

        const botName = bot?.name || "Thiago Rocha";
        const { data: newInstance, error: createInstErr } = await supabase
          .from("whatsapp_instances")
          .insert({
            organization_id: orgId,
            name: `Instagram - ${botName}`,
            channel_type: "instagram",
            is_connected: true,
            distribution_mode: "manual",
            instagram_username: botName,
          })
          .select("id, organization_id, name, channel_type, distribution_mode")
          .single();

        if (createInstErr || !newInstance) {
          console.error("📸 Error creating Instagram instance:", createInstErr);
          continue;
        }
        instance = newInstance;
        console.log("📸 Auto-created Instagram instance:", newInstance.id);
      } else if (!instance.is_connected) {
        // Ensure it's marked as connected
        await supabase.from("whatsapp_instances").update({ is_connected: true }).eq("id", instance.id);
      }

      const organizationId = instance.organization_id;
      const instanceId = instance.id;

      // =========================
      // BOT CONFIG
      // =========================
      let anyBotId: string | null = null;
      let activeBotId: string | null = null;

      const { data: anyBotResult } = await supabase.rpc('get_any_bot_for_instance', { p_instance_id: instanceId });
      if (anyBotResult) anyBotId = anyBotResult;

      const { data: activeBotResult } = await supabase.rpc('get_active_bot_for_instance', { p_instance_id: instanceId });
      if (activeBotResult) activeBotId = activeBotResult;

      const distributionMode = instance.distribution_mode || 'manual';

      // =========================
      // FIND/CREATE CONVERSATION
      // =========================
      // Use contactId as phone_number (identifier for SendPulse contacts)
      let { data: conversation } = await supabase
        .from("whatsapp_conversations")
        .select("id, lead_id, status, assigned_user_id, unread_count, organization_id")
        .eq("organization_id", organizationId)
        .eq("instance_id", instanceId)
        .eq("phone_number", contactId)
        .maybeSingle();

      let wasClosed = false;
      const now = new Date().toISOString();

      if (!conversation) {
        const displayName = contactName || `@${instagramUsername}`;

        const insertData: Record<string, unknown> = {
          organization_id: organizationId,
          instance_id: instanceId,
          current_instance_id: instanceId,
          phone_number: contactId,
          contact_name: displayName,
          display_name: displayName,
          sendable_phone: contactId,
          chat_id: `sendpulse:${contactId}`,
          status: "pending",
          unread_count: 1,
          last_message_at: now,
          last_customer_message_at: now,
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
        console.log("📸 Created new SendPulse Instagram conversation:", newConv.id);

        // AUTO-LINK LEAD BY INSTAGRAM USERNAME
        if (instagramUsername) {
          const { data: matchedLead } = await supabase
            .from("leads")
            .select("id, name, whatsapp, funnel_stage_id")
            .eq("organization_id", organizationId)
            .or(`instagram.eq.${instagramUsername},instagram.eq.@${instagramUsername}`)
            .limit(1)
            .maybeSingle();

          if (matchedLead) {
            console.log("📸 Auto-linked to lead:", matchedLead.id, matchedLead.name);
            await supabase
              .from("whatsapp_conversations")
              .update({ lead_id: matchedLead.id })
              .eq("id", conversation.id);

            await supabase.from("conversation_lead_links").insert({
              organization_id: organizationId,
              conversation_id: conversation.id,
              lead_id: matchedLead.id,
              channel_type: "instagram",
              linked_by: "auto_username",
              lead_name: matchedLead.name,
              instagram_username: instagramUsername,
              funnel_stage_at_link: matchedLead.funnel_stage_id,
            });

            conversation = { ...conversation, lead_id: matchedLead.id } as typeof conversation;
          }
        }

        // DISTRIBUTION
        if (distributionMode === 'bot' && anyBotId) {
          await supabase.from("whatsapp_conversations").update({
            status: 'with_bot',
            handling_bot_id: anyBotId,
            bot_started_at: now,
            bot_messages_count: 0,
          }).eq("id", conversation.id);
          conversation = { ...conversation, status: 'with_bot' } as typeof conversation;
        } else if (distributionMode === 'auto') {
          await supabase.rpc('reopen_whatsapp_conversation', {
            p_conversation_id: conversation.id,
            p_instance_id: instanceId,
          });
        }

      } else {
        // Update existing conversation
        wasClosed = conversation.status === 'closed';

        const updateData: Record<string, unknown> = {
          last_message_at: now,
          last_customer_message_at: now,
          unread_count: (conversation.unread_count || 0) + 1,
          current_instance_id: instanceId,
        };

        if (contactName) {
          updateData.contact_name = contactName;
          updateData.display_name = contactName;
        }

        if (wasClosed) {
          if (distributionMode === 'bot' && anyBotId) {
            updateData.status = 'with_bot';
            updateData.handling_bot_id = anyBotId;
            updateData.bot_started_at = now;
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
        conversation = { ...conversation, ...updateData } as typeof conversation;
        console.log("📸 Updated conversation:", conversation.id, wasClosed ? "(reopened)" : "");
      }

      if (!conversation) continue;

      // =========================
      // SAVE MESSAGE
      // =========================
      const newMsgId = crypto.randomUUID();
      const { error: msgError } = await supabase
        .from("whatsapp_messages")
        .insert({
          id: newMsgId,
          instance_id: instanceId,
          conversation_id: conversation.id,
          message_type: "text",
          content: lastMessage,
          direction: "inbound",
          status: "delivered",
          is_from_bot: false,
          provider: "sendpulse",
          provider_message_id: `sp_${contactId}_${Date.now()}`,
        });

      if (msgError) {
        console.error("📸 Error saving message:", msgError);
      } else {
        console.log("📸 Message saved:", newMsgId);

        // TRIGGER AI BOT
        const botIdToUse = anyBotId;
        if (
          botIdToUse &&
          (conversation as Record<string, unknown>).status === 'with_bot'
        ) {
          console.log("📸🤖 Triggering AI bot for SendPulse Instagram:", botIdToUse);

          fetch(`${SUPABASE_URL}/functions/v1/ai-bot-process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              botId: botIdToUse,
              conversationId: conversation.id,
              instanceId: instanceId,
              organizationId: organizationId,
              userMessage: lastMessage,
              contactName: contactName || `@${instagramUsername}`,
              phoneNumber: contactId,
              chatId: `sendpulse:${contactId}`,
              isFirstMessage: wasClosed,
              messageType: "text",
              isWithinSchedule: !!activeBotId,
              channelType: 'instagram',
              provider: 'sendpulse',
            }),
          }).then(async (res) => {
            const result = await res.json();
            console.log("📸🤖 Bot result:", result);
          }).catch((err) => {
            console.error("📸🤖 Bot error:", err);
          });
        }
      }

      processed++;
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("📸 sendpulse-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
