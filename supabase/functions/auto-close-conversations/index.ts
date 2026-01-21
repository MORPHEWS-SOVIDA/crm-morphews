import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Patterns to detect satisfaction ratings in text
const RATING_PATTERNS = [
  /^(10|[0-9])$/i,
  /\b(nota|avaliação|avalio|dou)\s*(10|[0-9])\b/i,
  /\b(10|[0-9])\s*(estrelas?|pontos?)\b/i,
  /\b(zero|um|dois|três|tres|quatro|cinco|seis|sete|oito|nove|dez)\b/i,
];

const TEXT_TO_NUMBER: Record<string, number> = {
  zero: 0, um: 1, dois: 2, três: 3, tres: 3, quatro: 4,
  cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
};

function extractRating(text: string): number | null {
  const cleaned = text.toLowerCase().trim();
  
  // Direct number match
  const directMatch = cleaned.match(/^(10|[0-9])$/);
  if (directMatch) return parseInt(directMatch[1]);
  
  // Number in context
  const contextMatch = cleaned.match(/\b(10|[0-9])\b/);
  if (contextMatch) return parseInt(contextMatch[1]);
  
  // Text to number
  for (const [word, num] of Object.entries(TEXT_TO_NUMBER)) {
    if (cleaned.includes(word)) return num;
  }
  
  return null;
}

function isWithinBusinessHours(start: string, end: string): boolean {
  const now = new Date();
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    let closedCount = 0;
    let surveysSent = 0;
    let ratingsProcessed = 0;

    // 1. Process pending satisfaction responses
    const { data: pendingConversations } = await supabase
      .from("whatsapp_conversations")
      .select("id, instance_id, organization_id, assigned_user_id, lead_id, satisfaction_sent_at")
      .eq("awaiting_satisfaction_response", true)
      .not("satisfaction_sent_at", "is", null);

    for (const conv of pendingConversations || []) {
      // Get latest inbound message after survey was sent
      const { data: recentMessages } = await supabase
        .from("whatsapp_messages")
        .select("content, created_at")
        .eq("conversation_id", conv.id)
        .eq("direction", "inbound")
        .gt("created_at", conv.satisfaction_sent_at)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentMessages && recentMessages.length > 0) {
        const message = recentMessages[0];
        const rating = extractRating(message.content || "");
        
        // Save rating (or mark for review if no valid rating)
        await supabase.from("conversation_satisfaction_ratings").insert({
          organization_id: conv.organization_id,
          conversation_id: conv.id,
          instance_id: conv.instance_id,
          assigned_user_id: conv.assigned_user_id,
          lead_id: conv.lead_id,
          rating: rating,
          raw_response: message.content,
          is_pending_review: rating !== null && rating <= 6, // Detractors need review
          responded_at: message.created_at,
        });

        // Clear awaiting flag
        await supabase
          .from("whatsapp_conversations")
          .update({ 
            awaiting_satisfaction_response: false,
            status: "closed" 
          })
          .eq("id", conv.id);

        ratingsProcessed++;
      }
    }

    // 2. Find and close inactive conversations
    const { data: instances } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("auto_close_enabled", true)
      .in("status", ["active", "connected"]);

    for (const instance of instances || []) {
      // Check business hours if configured
      if (instance.auto_close_only_business_hours) {
        if (!isWithinBusinessHours(
          instance.auto_close_business_start || "08:00",
          instance.auto_close_business_end || "20:00"
        )) {
          continue; // Skip this instance outside business hours
        }
      }

      // Get conversations to close
      const botCutoff = new Date(now.getTime() - (instance.auto_close_bot_minutes || 60) * 60 * 1000);
      const assignedCutoff = new Date(now.getTime() - (instance.auto_close_assigned_minutes || 480) * 60 * 1000);

      const { data: conversationsToClose } = await supabase
        .from("whatsapp_conversations")
        .select("id, status, assigned_user_id, lead_id, chat_id, organization_id, last_message_at")
        .or(`instance_id.eq.${instance.id},current_instance_id.eq.${instance.id}`)
        .in("status", ["pending", "assigned", "bot"])
        .eq("awaiting_satisfaction_response", false);

      for (const conv of conversationsToClose || []) {
        const lastMessage = new Date(conv.last_message_at || 0);
        const isBotConversation = conv.status === "bot";
        const cutoff = isBotConversation ? botCutoff : assignedCutoff;

        if (lastMessage < cutoff) {
          // Time to close this conversation
          
          // Send closing message if configured
          if (instance.auto_close_send_message && instance.auto_close_message_template) {
            let messageToSend = instance.auto_close_message_template;
            
            // If satisfaction survey enabled, append survey message
            if (instance.satisfaction_survey_enabled && instance.satisfaction_survey_message) {
              messageToSend += "\n\n" + instance.satisfaction_survey_message;
            }

            // Send message via Evolution API
            try {
              const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
              const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
              
              if (evolutionUrl && evolutionKey && instance.name) {
                await fetch(`${evolutionUrl}/message/sendText/${instance.name}`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "apikey": evolutionKey,
                  },
                  body: JSON.stringify({
                    number: conv.chat_id?.replace("@s.whatsapp.net", ""),
                    text: messageToSend,
                  }),
                });
              }
            } catch (e) {
              console.error("Error sending close message:", e);
            }
          }

          // Update conversation status
          const updateData: Record<string, unknown> = {
            status: instance.satisfaction_survey_enabled ? conv.status : "closed",
            awaiting_satisfaction_response: instance.satisfaction_survey_enabled,
            satisfaction_sent_at: instance.satisfaction_survey_enabled ? now.toISOString() : null,
          };

          await supabase
            .from("whatsapp_conversations")
            .update(updateData)
            .eq("id", conv.id);

          // If no survey, create rating record immediately
          if (!instance.satisfaction_survey_enabled) {
            await supabase.from("conversation_satisfaction_ratings").insert({
              organization_id: conv.organization_id,
              conversation_id: conv.id,
              instance_id: instance.id,
              assigned_user_id: conv.assigned_user_id,
              lead_id: conv.lead_id,
              rating: null, // No survey, no rating
              is_pending_review: false,
            });
          } else {
            surveysSent++;
          }

          closedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        closed: closedCount,
        surveysSent,
        ratingsProcessed,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in auto-close-conversations:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
