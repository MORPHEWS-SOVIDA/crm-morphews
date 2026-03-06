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
  
  if (cleaned.length > 50) {
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
    return null;
  }
  
  const directMatch = cleaned.match(/^(10|[0-9])$/);
  if (directMatch) return parseInt(directMatch[1]);
  
  const simpleContextMatch = cleaned.match(/^(?:nota\s*)?(10|[0-9])(?:\s*(?:pontos?|!|\.)?)?$/i);
  if (simpleContextMatch) return parseInt(simpleContextMatch[1]);
  
  const phraseMatch = cleaned.match(/(?:minha\s+)?nota\s*(?:é|:)?\s*(10|[0-9])|(?:dou|daria)\s*(?:nota\s*)?(10|[0-9])/i);
  if (phraseMatch) return parseInt(phraseMatch[1] || phraseMatch[2]);
  
  for (const [word, num] of Object.entries(TEXT_TO_NUMBER)) {
    if (cleaned === word || cleaned.match(new RegExp(`^${word}[!.]*$`))) {
      return num;
    }
  }
  
  return null;
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

    if (error || !data?.value) return null;
    return data.value as AdminConfig;
  } catch {
    return null;
  }
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

    let surveysSent = 0;
    let ratingsProcessed = 0;

    // =========================================================================
    // STEP 1: Process pending satisfaction responses (NPS replies)
    // =========================================================================
    const { data: pendingConversations } = await supabase
      .from("whatsapp_conversations")
      .select("id, instance_id, organization_id, assigned_user_id, lead_id, satisfaction_sent_at")
      .eq("awaiting_satisfaction_response", true)
      .not("satisfaction_sent_at", "is", null);

    console.log(`[nps-processor] Found ${pendingConversations?.length || 0} conversations awaiting NPS response`);

    for (const conv of pendingConversations || []) {
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
        
        console.log(`[nps-processor] NPS response for conv ${conv.id}: rating=${rating}`);

        const { data: existingRating } = await supabase
          .from("conversation_satisfaction_ratings")
          .select("id")
          .eq("conversation_id", conv.id)
          .is("rating", null)
          .limit(1)
          .single();

        if (existingRating) {
          await supabase
            .from("conversation_satisfaction_ratings")
            .update({
              rating,
              raw_response: message.content,
              is_pending_review: rating !== null && rating <= 6,
              responded_at: message.created_at,
            })
            .eq("id", existingRating.id);
        } else {
          await supabase.from("conversation_satisfaction_ratings").insert({
            organization_id: conv.organization_id,
            conversation_id: conv.id,
            instance_id: conv.instance_id,
            assigned_user_id: conv.assigned_user_id,
            lead_id: conv.lead_id,
            rating,
            raw_response: message.content,
            is_pending_review: rating !== null && rating <= 6,
            responded_at: message.created_at,
          });
        }

        await supabase
          .from("whatsapp_conversations")
          .update({ awaiting_satisfaction_response: false })
          .eq("id", conv.id);

        ratingsProcessed++;
      }
    }

    // =========================================================================
    // STEP 2: Send NPS messages for conversations closed by SQL function
    // (nps_pending = true, status = 'closed')
    // =========================================================================
    const { data: npsConversations } = await supabase
      .from("whatsapp_conversations")
      .select(`
        id, chat_id, instance_id, current_instance_id, organization_id,
        assigned_user_id, lead_id
      `)
      .eq("nps_pending", true)
      .eq("status", "closed")
      .limit(50); // Process max 50 per run to avoid timeout

    console.log(`[nps-processor] Found ${npsConversations?.length || 0} conversations pending NPS send`);

    if (npsConversations && npsConversations.length > 0) {
      const adminConfig = await getAdminWhatsAppConfig(supabase);

      if (!adminConfig?.api_url || !adminConfig?.api_key) {
        console.warn("[nps-processor] No admin WhatsApp config, skipping NPS sends");
      } else {
        // Get org survey messages (batch by org)
        const orgIds = [...new Set(npsConversations.map(c => c.organization_id))];
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, satisfaction_survey_message, auto_close_send_message, auto_close_message_template")
          .in("id", orgIds);

        const orgMap = new Map((orgs || []).map(o => [o.id, o]));

        // Get instance evolution IDs (batch)
        const instanceIds = [...new Set(npsConversations.flatMap(c => 
          [c.instance_id, c.current_instance_id].filter(Boolean)
        ))];
        const { data: instances } = await supabase
          .from("whatsapp_instances")
          .select("id, evolution_instance_id")
          .in("id", instanceIds);

        const instanceMap = new Map((instances || []).map(i => [i.id, i.evolution_instance_id]));

        for (const conv of npsConversations) {
          try {
            const org = orgMap.get(conv.organization_id);
            const phoneNumber = normalizeWhatsApp(conv.chat_id?.replace("@s.whatsapp.net", "") || "");
            const evolutionInstanceName = instanceMap.get(conv.current_instance_id || conv.instance_id);

            if (!phoneNumber || !evolutionInstanceName || !org) {
              // Mark as done even if we can't send
              await supabase
                .from("whatsapp_conversations")
                .update({ nps_pending: false })
                .eq("id", conv.id);
              continue;
            }

            // Build message
            let messageToSend = "";
            if (org.auto_close_send_message && org.auto_close_message_template) {
              messageToSend = org.auto_close_message_template;
            }
            if (org.satisfaction_survey_message) {
              messageToSend = messageToSend 
                ? messageToSend + "\n\n" + org.satisfaction_survey_message
                : org.satisfaction_survey_message;
            }

            if (messageToSend) {
              const sendUrl = `${adminConfig.api_url.replace(/\/$/, "")}/message/sendText/${evolutionInstanceName}`;
              
              const resp = await fetch(sendUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": adminConfig.api_key,
                },
                body: JSON.stringify({ number: phoneNumber, text: messageToSend }),
              });

              if (resp.ok) {
                console.log(`[nps-processor] NPS sent to ${phoneNumber}`);
                surveysSent++;
              } else {
                const errorBody = await resp.text();
                console.error(`[nps-processor] Failed NPS to ${phoneNumber}: ${resp.status} - ${errorBody.substring(0, 200)}`);
              }
            }

            // Create rating record + mark as sent
            await supabase.from("conversation_satisfaction_ratings").insert({
              organization_id: conv.organization_id,
              conversation_id: conv.id,
              instance_id: conv.instance_id,
              assigned_user_id: conv.assigned_user_id,
              lead_id: conv.lead_id,
              rating: null,
              is_pending_review: false,
            });

            await supabase
              .from("whatsapp_conversations")
              .update({
                nps_pending: false,
                awaiting_satisfaction_response: true,
                satisfaction_sent_at: new Date().toISOString(),
              })
              .eq("id", conv.id);

          } catch (e) {
            console.error(`[nps-processor] Error processing conv ${conv.id}:`, e);
            // Mark as done to avoid stuck loop
            await supabase
              .from("whatsapp_conversations")
              .update({ nps_pending: false })
              .eq("id", conv.id);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        surveysSent,
        ratingsProcessed,
        npsQueued: npsConversations?.length || 0,
        timestamp: new Date().toISOString(),
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
