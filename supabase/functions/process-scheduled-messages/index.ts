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

function normalizeWhatsApp(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (!clean.startsWith("55")) clean = `55${clean}`;
  if (clean.length === 12 && clean.startsWith("55")) {
    clean = clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
}

interface ScheduledMessage {
  id: string;
  lead_id: string;
  whatsapp_instance_id: string | null;
  final_message: string;
  scheduled_at: string;
  status: string;
  media_type: string | null;
  media_url: string | null;
  media_filename: string | null;
}

interface Lead {
  whatsapp: string;
  name: string;
}

interface WhatsAppInstance {
  id: string;
  evolution_instance_id: string;
  is_connected: boolean;
  status: string;
}

async function sendMessageViaEvolution(
  instanceName: string, 
  phone: string, 
  message: string,
  mediaType?: string | null,
  mediaUrl?: string | null,
  mediaFilename?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // If we have media, send it first
    if (mediaUrl && mediaType) {
      let endpoint = '';
      let body: Record<string, unknown> = { number: phone };

      if (mediaType === 'image') {
        endpoint = `${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`;
        body = { ...body, mediatype: 'image', media: mediaUrl, caption: message };
      } else if (mediaType === 'audio') {
        endpoint = `${EVOLUTION_API_URL}/message/sendWhatsAppAudio/${instanceName}`;
        body = { ...body, audio: mediaUrl };
      } else if (mediaType === 'document') {
        endpoint = `${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`;
        body = { ...body, mediatype: 'document', media: mediaUrl, fileName: mediaFilename || 'document', caption: message };
      }

      console.log(`Sending ${mediaType} to ${phone} via instance ${instanceName}`);

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": EVOLUTION_API_KEY,
        },
        body: JSON.stringify(body),
      });

      const raw = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        const errorMsg = raw?.message || raw?.error || `HTTP ${resp.status}`;
        console.error(`Evolution API error: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      // For audio, send text separately if present
      if (mediaType === 'audio' && message) {
        await sendTextMessage(instanceName, phone, message);
      }

      console.log(`Media sent successfully to ${phone}`);
      return { success: true };
    }

    // Text only message
    return await sendTextMessage(instanceName, phone, message);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error sending message: ${msg}`);
    return { success: false, error: msg };
  }
}

async function sendTextMessage(instanceName: string, phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  const url = `${EVOLUTION_API_URL}/message/sendText/${instanceName}`;
  const body = { number: phone, text: message };

  console.log(`Sending text to ${phone} via instance ${instanceName}`);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_API_KEY,
    },
    body: JSON.stringify(body),
  });

  const raw = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const errorMsg = raw?.message || raw?.error || `HTTP ${resp.status}`;
    console.error(`Evolution API error: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  console.log(`Text sent successfully to ${phone}`);
  return { success: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("=== Processing Scheduled Messages ===");
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error("Evolution API credentials not configured");
    }

    // Fetch pending messages where scheduled_at <= now
    const now = new Date().toISOString();
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("lead_scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .is("deleted_at", null)
      .limit(50); // Process in batches

    if (fetchError) {
      throw new Error(`Error fetching messages: ${fetchError.message}`);
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log("No pending messages to process");
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0, 
        message: "No pending messages" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${pendingMessages.length} pending messages to process`);

    let sentCount = 0;
    let failedCount = 0;

    for (const msg of pendingMessages as ScheduledMessage[]) {
      console.log(`Processing message ${msg.id} for lead ${msg.lead_id}`);

      try {
        // Get lead's WhatsApp number
        const { data: lead, error: leadError } = await supabase
          .from("leads")
          .select("whatsapp, name")
          .eq("id", msg.lead_id)
          .single();

        if (leadError || !lead) {
          console.error(`Lead not found: ${msg.lead_id}`);
          await supabase
            .from("lead_scheduled_messages")
            .update({ 
              status: "failed_other", 
              failure_reason: "Lead não encontrado",
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);
          failedCount++;
          continue;
        }

        const normalizedPhone = normalizeWhatsApp(lead.whatsapp);
        if (!normalizedPhone) {
          console.error(`Invalid phone for lead ${msg.lead_id}: ${lead.whatsapp}`);
          await supabase
            .from("lead_scheduled_messages")
            .update({ 
              status: "failed_other", 
              failure_reason: "Telefone inválido",
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);
          failedCount++;
          continue;
        }

        // Check if we have a WhatsApp instance configured
        if (!msg.whatsapp_instance_id) {
          console.error(`No WhatsApp instance configured for message ${msg.id}`);
          await supabase
            .from("lead_scheduled_messages")
            .update({ 
              status: "failed_other", 
              failure_reason: "Nenhuma instância WhatsApp configurada",
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);
          failedCount++;
          continue;
        }

        // Get the WhatsApp instance
        const { data: instance, error: instanceError } = await supabase
          .from("whatsapp_instances")
          .select("id, evolution_instance_id, is_connected, status")
          .eq("id", msg.whatsapp_instance_id)
          .single();

        if (instanceError || !instance) {
          console.error(`Instance not found: ${msg.whatsapp_instance_id}`);
          await supabase
            .from("lead_scheduled_messages")
            .update({ 
              status: "failed_other", 
              failure_reason: "Instância WhatsApp não encontrada",
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);
          failedCount++;
          continue;
        }

        // Check if instance is connected
        if (!instance.is_connected || instance.status !== "active") {
          console.warn(`Instance ${instance.evolution_instance_id} is not connected (status: ${instance.status})`);
          await supabase
            .from("lead_scheduled_messages")
            .update({ 
              status: "failed_offline", 
              failure_reason: `Instância desconectada (status: ${instance.status})`,
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);
          failedCount++;
          continue;
        }

        // Send the message via Evolution API
        const sendResult = await sendMessageViaEvolution(
          instance.evolution_instance_id,
          normalizedPhone,
          msg.final_message,
          msg.media_type,
          msg.media_url,
          msg.media_filename
        );

        if (sendResult.success) {
          await supabase
            .from("lead_scheduled_messages")
            .update({ 
              status: "sent", 
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);
          sentCount++;
          console.log(`Message ${msg.id} sent successfully`);
        } else {
          await supabase
            .from("lead_scheduled_messages")
            .update({ 
              status: "failed_other", 
              failure_reason: sendResult.error || "Erro desconhecido ao enviar",
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);
          failedCount++;
          console.error(`Message ${msg.id} failed: ${sendResult.error}`);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error processing message ${msg.id}: ${errorMsg}`);
        await supabase
          .from("lead_scheduled_messages")
          .update({ 
            status: "failed_other", 
            failure_reason: errorMsg,
            updated_at: new Date().toISOString()
          })
          .eq("id", msg.id);
        failedCount++;
      }
    }

    console.log(`=== Processing Complete ===`);
    console.log(`Sent: ${sentCount}, Failed: ${failedCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: pendingMessages.length,
      sent: sentCount,
      failed: failedCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("process-scheduled-messages error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
