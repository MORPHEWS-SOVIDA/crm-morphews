import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Patterns to detect satisfaction ratings in text
const TEXT_TO_NUMBER: Record<string, number> = {
  zero: 0, um: 1, dois: 2, três: 3, tres: 3, quatro: 4,
  cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
};

function extractRating(text: string): number | null {
  const cleaned = text.toLowerCase().trim();
  
  // Only accept short responses (up to ~50 chars) that look like ratings
  // Long messages are likely regular conversation, not NPS responses
  if (cleaned.length > 50) {
    // For longer messages, only accept if it's clearly a rating phrase
    const ratingPhrases = [
      /(?:minha\s+)?nota\s*(?:é|:)?\s*(10|[0-9])/i,
      /(?:dou|daria)\s*(?:nota\s*)?(10|[0-9])/i,
      /^(10|[0-9])\s*(?:pontos?)?$/i,
      /aval(?:io|iação)\s*(?:com)?\s*(10|[0-9])/i,
    ];
    
    for (const pattern of ratingPhrases) {
      const match = cleaned.match(pattern);
      if (match) return parseInt(match[1]);
    }
    
    // Long message without clear rating phrase - ignore
    return null;
  }
  
  // Direct number match (just "10" or "8")
  const directMatch = cleaned.match(/^(10|[0-9])$/);
  if (directMatch) return parseInt(directMatch[1]);
  
  // Number with simple context like "nota 10", "10 pontos", etc.
  const simpleContextMatch = cleaned.match(/^(?:nota\s*)?(10|[0-9])(?:\s*(?:pontos?|!|\.)?)?$/i);
  if (simpleContextMatch) return parseInt(simpleContextMatch[1]);
  
  // Phrases like "dou nota 8", "minha nota é 10"
  const phraseMatch = cleaned.match(/(?:minha\s+)?nota\s*(?:é|:)?\s*(10|[0-9])|(?:dou|daria)\s*(?:nota\s*)?(10|[0-9])/i);
  if (phraseMatch) return parseInt(phraseMatch[1] || phraseMatch[2]);
  
  // Text to number (only for short responses)
  for (const [word, num] of Object.entries(TEXT_TO_NUMBER)) {
    // Only accept if the word is the main content
    if (cleaned === word || cleaned.match(new RegExp(`^${word}[!.]*$`))) {
      return num;
    }
  }
  
  return null;
}

function isWithinBusinessHours(start: string, end: string): boolean {
  // Get current time in Brazil/Sao_Paulo timezone (UTC-3)
  const now = new Date();
  const brasiliaOffset = -3; // UTC-3
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  
  // Convert to Brasilia time
  let brasiliaHours = utcHours + brasiliaOffset;
  if (brasiliaHours < 0) brasiliaHours += 24;
  
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  
  const currentMinutes = brasiliaHours * 60 + utcMinutes;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  console.log(`[auto-close] Business hours check: current=${brasiliaHours}:${utcMinutes} (Brasilia), range=${start}-${end}`);
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

interface AdminConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
}

// deno-lint-ignore no-explicit-any
async function getAdminWhatsAppConfig(supabase: any): Promise<AdminConfig | null> {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "admin_whatsapp_instance")
      .single();

    if (error) {
      console.error("Error fetching admin config:", error);
      return null;
    }

    if (data && data.value) {
      return data.value as AdminConfig;
    }
    return null;
  } catch (error) {
    console.error("Error fetching admin whatsapp config:", error);
    return null;
  }
}

function normalizeWhatsApp(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (!clean.startsWith("55")) clean = `55${clean}`;
  if (clean.length === 12 && clean.startsWith("55")) {
    clean = clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
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

    console.log(`[auto-close] Found ${pendingConversations?.length || 0} conversations awaiting NPS response`);

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
        
        console.log(`[auto-close] Processing NPS response for conv ${conv.id}: rating=${rating}, response="${message.content?.substring(0, 50)}"`);

        // Try to UPDATE existing rating record first
        const { data: existingRating } = await supabase
          .from("conversation_satisfaction_ratings")
          .select("id")
          .eq("conversation_id", conv.id)
          .is("rating", null)
          .limit(1)
          .single();

        if (existingRating) {
          // Update existing rating record
          await supabase
            .from("conversation_satisfaction_ratings")
            .update({
              rating: rating,
              raw_response: message.content,
              is_pending_review: rating !== null && rating <= 6, // Detractors need review
              responded_at: message.created_at,
            })
            .eq("id", existingRating.id);
            
          console.log(`[auto-close] Updated existing rating ${existingRating.id} with rating ${rating}`);
        } else {
          // Create new rating record if none exists
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
          
          console.log(`[auto-close] Created new rating record for conv ${conv.id}`);
        }

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

    // 2. Get all organizations with auto-close enabled
    const { data: organizations } = await supabase
      .from("organizations")
      .select(`
        id,
        name,
        auto_close_enabled,
        auto_close_bot_minutes,
        auto_close_assigned_minutes,
        auto_close_only_business_hours,
        auto_close_business_start,
        auto_close_business_end,
        auto_close_send_message,
        auto_close_message_template,
        satisfaction_survey_enabled,
        satisfaction_survey_on_auto_close,
        satisfaction_survey_message
      `)
      .eq("auto_close_enabled", true);

    for (const org of organizations || []) {
      // Check business hours if configured
      if (org.auto_close_only_business_hours) {
        if (!isWithinBusinessHours(
          org.auto_close_business_start || "08:00",
          org.auto_close_business_end || "20:00"
        )) {
          continue; // Skip this org outside business hours
        }
      }

      // Get active instances for this org
      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("id, name, organization_id, evolution_instance_id")
        .eq("organization_id", org.id)
        .in("status", ["active", "connected"]);

      const botCutoff = new Date(now.getTime() - (org.auto_close_bot_minutes || 60) * 60 * 1000);
      const assignedCutoff = new Date(now.getTime() - (org.auto_close_assigned_minutes || 480) * 60 * 1000);
      
      console.log(`[auto-close] Org ${org.id} (${org.name}): botCutoff=${botCutoff.toISOString()}, assignedCutoff=${assignedCutoff.toISOString()}, instances=${instances?.length || 0}`);

      for (const instance of instances || []) {
        // Get conversations to close for this instance
        const { data: conversationsToClose } = await supabase
          .from("whatsapp_conversations")
          .select("id, status, assigned_user_id, lead_id, chat_id, organization_id, last_message_at")
          .or(`instance_id.eq.${instance.id},current_instance_id.eq.${instance.id}`)
          .in("status", ["pending", "assigned", "with_bot"])
          .eq("awaiting_satisfaction_response", false);

        console.log(`[auto-close] Instance ${instance.name}: found ${conversationsToClose?.length || 0} conversations to check`);
        
        for (const conv of conversationsToClose || []) {
          const lastMessage = new Date(conv.last_message_at || 0);
          const isBotConversation = conv.status === "with_bot";
          const cutoff = isBotConversation ? botCutoff : assignedCutoff;

          if (lastMessage < cutoff) {
            // Time to close this conversation
            const phoneNumber = normalizeWhatsApp(conv.chat_id?.replace("@s.whatsapp.net", "") || "");
            
            // Check if should send NPS survey
            const shouldSendNPS = org.satisfaction_survey_enabled && org.satisfaction_survey_on_auto_close;
            
            // Send closing message and/or NPS survey if configured
            if ((org.auto_close_send_message || shouldSendNPS) && phoneNumber) {
              let messageToSend = "";
              
              // Add close message if configured
              if (org.auto_close_send_message && org.auto_close_message_template) {
                messageToSend = org.auto_close_message_template;
              }
              
              // Add NPS survey if enabled for auto-close
              if (shouldSendNPS && org.satisfaction_survey_message) {
                if (messageToSend) {
                  messageToSend += "\n\n" + org.satisfaction_survey_message;
                } else {
                  messageToSend = org.satisfaction_survey_message;
                }
              }

              if (messageToSend) {
                // Send message via the conversation's WhatsApp instance
                try {
                  const adminConfig = await getAdminWhatsAppConfig(supabase);
                  
                  if (adminConfig?.api_url && adminConfig?.api_key) {
                    const evolutionInstanceName = (instance as any)?.evolution_instance_id;
                    
                    if (evolutionInstanceName) {
                      const sendUrl = `${adminConfig.api_url.replace(/\/$/, "")}/message/sendText/${evolutionInstanceName}`;
                      console.log(`[auto-close] Sending NPS to ${phoneNumber} via ${evolutionInstanceName} (conv: ${conv.id})`);
                      
                      const resp = await fetch(sendUrl, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "apikey": adminConfig.api_key,
                        },
                        body: JSON.stringify({
                          number: phoneNumber,
                          text: messageToSend,
                        }),
                      });
                      
                      if (!resp.ok) {
                        const errorBody = await resp.text();
                        console.error(`[auto-close] Failed to send NPS to ${phoneNumber}: ${resp.status} - ${errorBody.substring(0, 300)}`);
                      } else {
                        console.log(`[auto-close] NPS sent to ${phoneNumber} via ${evolutionInstanceName}`);
                        if (shouldSendNPS) surveysSent++;
                      }
                    } else {
                      console.warn(`[auto-close] No evolution_instance_id for instance ${instance.id} (${instance.name}), skipping NPS send`);
                    }
                  } else {
                    console.warn("[auto-close] No admin WhatsApp config (missing api_url or api_key)");
                  }
                } catch (e) {
                  console.error("[auto-close] Error sending NPS message:", e);
                }
              }
            }

            // Update conversation status
            const updateData: Record<string, unknown> = {
              status: "closed",
              closed_at: now.toISOString(),
              awaiting_satisfaction_response: shouldSendNPS,
              satisfaction_sent_at: shouldSendNPS ? now.toISOString() : null,
            };

            await supabase
              .from("whatsapp_conversations")
              .update(updateData)
              .eq("id", conv.id);

            // Create rating record
            await supabase.from("conversation_satisfaction_ratings").insert({
              organization_id: conv.organization_id,
              conversation_id: conv.id,
              instance_id: instance.id,
              assigned_user_id: conv.assigned_user_id,
              lead_id: conv.lead_id,
              rating: null,
              is_pending_review: false,
            });

            closedCount++;
          }
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
