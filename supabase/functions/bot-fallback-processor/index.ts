import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * This function processes scheduled messages that have been sent
 * and have fallback_bot_enabled = true.
 * 
 * If the timeout has passed and no human has claimed/responded to the conversation,
 * the specified bot takes over.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== Bot Fallback Processor ===");
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    // Find messages that:
    // 1. Were sent successfully (status = 'sent')
    // 2. Have fallback enabled and a bot configured
    // 3. Haven't been processed for fallback yet (fallback_triggered_at IS NULL)
    // 4. The timeout has passed (sent_at + timeout_minutes <= now)
    const { data: eligibleMessages, error: fetchError } = await supabase
      .from("lead_scheduled_messages")
      .select(`
        id,
        lead_id,
        whatsapp_instance_id,
        fallback_bot_id,
        fallback_timeout_minutes,
        sent_at,
        organization_id
      `)
      .eq("status", "sent")
      .eq("fallback_bot_enabled", true)
      .not("fallback_bot_id", "is", null)
      .is("fallback_triggered_at", null)
      .not("sent_at", "is", null)
      .limit(50);

    if (fetchError) {
      throw new Error(`Error fetching messages: ${fetchError.message}`);
    }

    if (!eligibleMessages || eligibleMessages.length === 0) {
      console.log("No messages eligible for bot fallback");
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0, 
        message: "No eligible messages" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${eligibleMessages.length} messages to check for fallback`);

    let triggeredCount = 0;
    let skippedCount = 0;

    for (const msg of eligibleMessages) {
      try {
        // Check if timeout has passed
        const sentAt = new Date(msg.sent_at);
        const timeoutMs = (msg.fallback_timeout_minutes || 30) * 60 * 1000;
        const deadlineAt = new Date(sentAt.getTime() + timeoutMs);
        
        if (new Date() < deadlineAt) {
          // Timeout hasn't passed yet
          console.log(`Message ${msg.id}: timeout not reached yet (deadline: ${deadlineAt.toISOString()})`);
          continue;
        }

        // Get the lead's phone to find the conversation
        const { data: lead, error: leadError } = await supabase
          .from("leads")
          .select("whatsapp")
          .eq("id", msg.lead_id)
          .single();

        if (leadError || !lead?.whatsapp) {
          console.error(`Lead not found for message ${msg.id}`);
          await markFallbackFailed(msg.id, "Lead não encontrado");
          skippedCount++;
          continue;
        }

        // Normalize phone
        const normalizedPhone = normalizeWhatsApp(lead.whatsapp);

        // Find the conversation for this lead/instance
        const { data: conversation, error: convError } = await supabase
          .from("whatsapp_conversations")
          .select("id, status, assigned_user_id, handling_bot_id, last_message_at")
          .eq("instance_id", msg.whatsapp_instance_id)
          .eq("phone_number", normalizedPhone)
          .single();

        if (convError || !conversation) {
          console.error(`Conversation not found for message ${msg.id}`);
          await markFallbackFailed(msg.id, "Conversa não encontrada");
          skippedCount++;
          continue;
        }

        // Check if a human has already claimed or is responding
        if (conversation.status === "assigned" && conversation.assigned_user_id) {
          console.log(`Message ${msg.id}: conversation already assigned to human`);
          await markFallbackSkipped(msg.id, "Vendedor já assumiu");
          skippedCount++;
          continue;
        }

        // Check if another bot is already handling
        if (conversation.handling_bot_id) {
          console.log(`Message ${msg.id}: another bot is already handling`);
          await markFallbackSkipped(msg.id, "Outro robô já está atendendo");
          skippedCount++;
          continue;
        }

        // Check if conversation is closed
        if (conversation.status === "closed") {
          console.log(`Message ${msg.id}: conversation is closed`);
          await markFallbackSkipped(msg.id, "Conversa encerrada");
          skippedCount++;
          continue;
        }

        // Check if there was any human outbound message after sent_at
        const { data: humanMessages, error: msgError } = await supabase
          .from("whatsapp_messages")
          .select("id")
          .eq("conversation_id", conversation.id)
          .eq("direction", "outbound")
          .eq("is_from_bot", false)
          .gte("created_at", msg.sent_at)
          .limit(1);

        if (!msgError && humanMessages && humanMessages.length > 0) {
          console.log(`Message ${msg.id}: human already responded`);
          await markFallbackSkipped(msg.id, "Vendedor já respondeu");
          skippedCount++;
          continue;
        }

        // All checks passed - activate the bot!
        console.log(`Message ${msg.id}: activating bot ${msg.fallback_bot_id} for conversation ${conversation.id}`);

        // Update conversation to be handled by bot
        const { error: updateError } = await supabase
          .from("whatsapp_conversations")
          .update({
            status: "bot",
            handling_bot_id: msg.fallback_bot_id,
            bot_started_at: new Date().toISOString(),
            assigned_user_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);

        if (updateError) {
          console.error(`Error updating conversation: ${updateError.message}`);
          await markFallbackFailed(msg.id, updateError.message);
          skippedCount++;
          continue;
        }

        // Mark fallback as triggered
        await supabase
          .from("lead_scheduled_messages")
          .update({
            fallback_triggered_at: new Date().toISOString(),
            fallback_status: "triggered",
            updated_at: new Date().toISOString(),
          })
          .eq("id", msg.id);

        triggeredCount++;
        console.log(`Message ${msg.id}: bot fallback triggered successfully`);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error processing message ${msg.id}: ${errorMsg}`);
        await markFallbackFailed(msg.id, errorMsg);
        skippedCount++;
      }
    }

    console.log(`=== Processing Complete ===`);
    console.log(`Triggered: ${triggeredCount}, Skipped: ${skippedCount}`);

    return new Response(JSON.stringify({
      success: true,
      checked: eligibleMessages.length,
      triggered: triggeredCount,
      skipped: skippedCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("bot-fallback-processor error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function normalizeWhatsApp(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (!clean.startsWith("55")) clean = `55${clean}`;
  if (clean.length === 12 && clean.startsWith("55")) {
    clean = clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
}

async function markFallbackFailed(messageId: string, reason: string) {
  await supabase
    .from("lead_scheduled_messages")
    .update({
      fallback_triggered_at: new Date().toISOString(),
      fallback_status: `failed: ${reason}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId);
}

async function markFallbackSkipped(messageId: string, reason: string) {
  await supabase
    .from("lead_scheduled_messages")
    .update({
      fallback_triggered_at: new Date().toISOString(),
      fallback_status: `skipped: ${reason}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId);
}
