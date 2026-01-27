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

    // 2. Get all organizations with auto-close enabled
    const { data: organizations } = await supabase
      .from("organizations")
      .select(`
        id,
        auto_close_enabled,
        auto_close_bot_minutes,
        auto_close_assigned_minutes,
        auto_close_only_business_hours,
        auto_close_business_start,
        auto_close_business_end,
        auto_close_send_message,
        auto_close_message_template,
        satisfaction_survey_enabled,
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
        .select("id, name, organization_id")
        .eq("organization_id", org.id)
        .in("status", ["active", "connected"]);

      const botCutoff = new Date(now.getTime() - (org.auto_close_bot_minutes || 60) * 60 * 1000);
      const assignedCutoff = new Date(now.getTime() - (org.auto_close_assigned_minutes || 480) * 60 * 1000);
      
      console.log(`[auto-close] Org ${org.id}: botCutoff=${botCutoff.toISOString()}, assignedCutoff=${assignedCutoff.toISOString()}, instances=${instances?.length || 0}`);

      for (const instance of instances || []) {
        // Get conversations to close for this instance
        // Note: status is "with_bot" in DB, not just "bot"
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
            
            // Send closing message if configured
            if (org.auto_close_send_message && org.auto_close_message_template && phoneNumber) {
              let messageToSend = org.auto_close_message_template;
              
              // If satisfaction survey enabled, append survey message
              if (org.satisfaction_survey_enabled && org.satisfaction_survey_message) {
                messageToSend += "\n\n" + org.satisfaction_survey_message;
              }

              // Send message via admin Evolution API config
              try {
                const adminConfig = await getAdminWhatsAppConfig(supabase);
                
                if (adminConfig?.api_url && adminConfig?.api_key) {
                  // Get the evolution instance name from the instance record
                  const { data: instanceData } = await supabase
                    .from("whatsapp_instances")
                    .select("evolution_instance_id")
                    .eq("id", instance.id)
                    .single();
                  
                  const evolutionInstanceName = (instanceData as any)?.evolution_instance_id || instance.name;
                  
                  if (evolutionInstanceName) {
                    const sendUrl = `${adminConfig.api_url.replace(/\/$/, "")}/message/sendText/${evolutionInstanceName}`;
                    console.log(`[auto-close] Sending to ${phoneNumber} via ${evolutionInstanceName}`);
                    
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
                      console.error(`[auto-close] Failed to send: ${resp.status} - ${errorBody}`);
                    } else {
                      console.log(`[auto-close] Message sent successfully to ${phoneNumber}`);
                    }
                  }
                } else {
                  console.warn("[auto-close] No admin WhatsApp config found, cannot send message");
                }
              } catch (e) {
                console.error("[auto-close] Error sending close message:", e);
              }
            }

            // Update conversation status - ALWAYS close when survey sent
            const updateData: Record<string, unknown> = {
              status: "closed", // Always set to closed
              closed_at: now.toISOString(),
              awaiting_satisfaction_response: org.satisfaction_survey_enabled,
              satisfaction_sent_at: org.satisfaction_survey_enabled ? now.toISOString() : null,
            };

            await supabase
              .from("whatsapp_conversations")
              .update(updateData)
              .eq("id", conv.id);

            // If no survey, create rating record immediately
            if (!org.satisfaction_survey_enabled) {
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
