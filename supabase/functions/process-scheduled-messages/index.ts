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
  organization_id: string;
  lead_id: string;
  whatsapp_instance_id: string | null;
  fallback_instance_ids: string[] | null;
  attempt_count: number;
  current_instance_index: number;
  max_attempts: number;
  final_message: string;
  scheduled_at: string;
  status: string;
  media_type: string | null;
  media_url: string | null;
  media_filename: string | null;
  channel_type: string | null; // 'whatsapp' or 'sms'
  sms_phone: string | null;
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
  organization_id: string;
}

// Get all connected instances for an organization to use as fallbacks
async function getConnectedInstancesForOrg(organizationId: string): Promise<WhatsAppInstance[]> {
  const { data, error } = await supabase
    .from("whatsapp_instances")
    .select("id, evolution_instance_id, is_connected, status, organization_id")
    .eq("organization_id", organizationId)
    .eq("is_connected", true)
    .eq("status", "active");

  if (error) {
    console.error("Error fetching connected instances:", error);
    return [];
  }
  return data || [];
}

// Try to send with fallback logic
async function sendWithFallback(
  msg: ScheduledMessage,
  lead: Lead,
  normalizedPhone: string
): Promise<{ success: boolean; error?: string; usedInstanceId?: string }> {
  // Build the list of instances to try
  const instancestoTry: string[] = [];
  
  // First, try the primary instance if set
  if (msg.whatsapp_instance_id) {
    instancestoTry.push(msg.whatsapp_instance_id);
  }
  
  // Then add fallback instances
  if (msg.fallback_instance_ids && msg.fallback_instance_ids.length > 0) {
    for (const id of msg.fallback_instance_ids) {
      if (!instancestoTry.includes(id)) {
        instancestoTry.push(id);
      }
    }
  }
  
  // If no instances configured, get all connected instances for the org
  if (instancestoTry.length === 0) {
    const connectedInstances = await getConnectedInstancesForOrg(msg.organization_id);
    for (const inst of connectedInstances) {
      instancestoTry.push(inst.id);
    }
  }
  
  if (instancestoTry.length === 0) {
    return { success: false, error: "Nenhuma instância WhatsApp conectada disponível" };
  }
  
  // Start from the current index
  const startIndex = Math.min(msg.current_instance_index, instancestoTry.length - 1);
  
  for (let i = startIndex; i < instancestoTry.length; i++) {
    const instanceId = instancestoTry[i];
    
    // Get the instance details
    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id, evolution_instance_id, is_connected, status, organization_id")
      .eq("id", instanceId)
      .single();
    
    if (instanceError || !instance) {
      console.warn(`Instance ${instanceId} not found, trying next...`);
      continue;
    }
    
    // Check if instance is connected
    if (!instance.is_connected || instance.status !== "active") {
      console.warn(`Instance ${instance.evolution_instance_id} is not connected (status: ${instance.status}), trying next...`);
      continue;
    }
    
    // Try to send
    console.log(`Attempting to send via instance ${instance.evolution_instance_id} (index ${i}/${instancestoTry.length})`);
    const sendResult = await sendMessageViaEvolution(
      instance.evolution_instance_id,
      normalizedPhone,
      msg.final_message,
      msg.media_type,
      msg.media_url,
      msg.media_filename
    );
    
    if (sendResult.success) {
      // Update current index for next time
      await supabase
        .from("lead_scheduled_messages")
        .update({ 
          current_instance_index: i,
          whatsapp_instance_id: instanceId,
        })
        .eq("id", msg.id);
      
      return { success: true, usedInstanceId: instanceId };
    }
    
    // If Bad Request, it's a phone number issue - don't try other instances
    if (sendResult.error?.includes("Bad Request")) {
      return { success: false, error: sendResult.error };
    }
    
    console.warn(`Send failed via ${instance.evolution_instance_id}: ${sendResult.error}, trying next...`);
  }
  
  // All instances failed
  return { success: false, error: `Falha em todas as ${instancestoTry.length} instâncias tentadas` };
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

// Send message via SMS using FacilitaMóvel
async function sendViaSms(
  msg: ScheduledMessage, 
  lead: Lead, 
  normalizedPhone: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get SMS provider config for the organization
    const { data: config, error: configError } = await supabase
      .from('sms_provider_config')
      .select('api_user, api_password, is_active')
      .eq('organization_id', msg.organization_id)
      .eq('provider', 'facilitamovel')
      .single();

    if (configError || !config || !config.is_active || !config.api_user || !config.api_password) {
      console.error(`SMS provider not configured for org ${msg.organization_id}`);
      return { success: false, error: 'Provedor de SMS não configurado' };
    }

    // Check SMS credits balance
    const { data: balance } = await supabase
      .from('sms_credits_balance')
      .select('current_credits')
      .eq('organization_id', msg.organization_id)
      .single();

    if (!balance || balance.current_credits < 1) {
      console.error(`No SMS credits for org ${msg.organization_id}`);
      return { success: false, error: 'Créditos de SMS insuficientes' };
    }

    // Format phone for SMS (remove +55 if present, keep just DDD+number)
    let formattedPhone = normalizedPhone.replace(/\D/g, '');
    if (formattedPhone.startsWith('55') && formattedPhone.length > 11) {
      formattedPhone = formattedPhone.substring(2);
    }

    // Generate external key
    const extKey = `sched-${msg.id}`;

    // Encode message for URL
    const encodedMessage = encodeURIComponent(msg.final_message);

    // Call FacilitaMóvel API
    const facilitaUrl = `https://www.facilitamovel.com.br/api/simpleSend.ft?user=${encodeURIComponent(config.api_user)}&password=${encodeURIComponent(config.api_password)}&destinatario=${formattedPhone}&msg=${encodedMessage}&externalkey=${extKey}`;

    console.log(`Sending SMS to ${formattedPhone} via FacilitaMóvel`);

    const response = await fetch(facilitaUrl);
    const responseText = await response.text();
    console.log('FacilitaMóvel response:', responseText);

    // Parse response (format: "6 - Mensagem enviada;123456" or error codes)
    const [statusPart, smsId] = responseText.split(';');
    const statusCode = parseInt(statusPart.split(' ')[0] || statusPart);

    let errorMessage: string | null = null;

    switch (statusCode) {
      case 5: // Mensagem Agendada
      case 6: // Mensagem enviada
        // Success - deduct credits
        await supabase.rpc('deduct_sms_credits', {
          p_organization_id: msg.organization_id,
          p_credits_to_deduct: 1,
        });

        // Log usage
        await supabase.from('sms_usage').insert({
          organization_id: msg.organization_id,
          lead_id: msg.lead_id,
          phone: formattedPhone,
          message: msg.final_message,
          facilita_sms_id: smsId?.trim() || null,
          external_key: extKey,
          status: 'sent',
          status_code: statusCode,
          credits_used: 1,
        });

        console.log(`SMS sent successfully to ${formattedPhone}, smsId: ${smsId}`);
        return { success: true };

      case 1:
        errorMessage = 'Login inválido na plataforma FacilitaMóvel';
        break;
      case 2:
        errorMessage = 'Usuário sem créditos na FacilitaMóvel';
        break;
      case 3:
        errorMessage = 'Número de celular inválido';
        break;
      case 4:
        errorMessage = 'Mensagem inválida';
        break;
      default:
        errorMessage = `Erro FacilitaMóvel: ${responseText}`;
    }

    // Log failed attempt
    await supabase.from('sms_usage').insert({
      organization_id: msg.organization_id,
      lead_id: msg.lead_id,
      phone: formattedPhone,
      message: msg.final_message,
      external_key: extKey,
      status: 'failed',
      status_code: statusCode,
      credits_used: 0,
      error_message: errorMessage,
    });

    console.error(`SMS failed: ${errorMessage}`);
    return { success: false, error: errorMessage };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown SMS error';
    console.error(`Error sending SMS: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
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
        // Update attempt tracking
        const attemptCount = (msg.attempt_count || 0) + 1;
        await supabase
          .from("lead_scheduled_messages")
          .update({ 
            attempt_count: attemptCount,
            last_attempt_at: new Date().toISOString(),
          })
          .eq("id", msg.id);

        // Check max attempts
        if (attemptCount > (msg.max_attempts || 3)) {
          console.warn(`Message ${msg.id} exceeded max attempts (${attemptCount}/${msg.max_attempts || 3})`);
          await supabase
            .from("lead_scheduled_messages")
            .update({ 
              status: "failed_other", 
              failure_reason: `Excedeu máximo de ${msg.max_attempts || 3} tentativas`,
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);
          failedCount++;
          continue;
        }

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

        // Check channel type and send accordingly
        const channelType = msg.channel_type || 'whatsapp';
        let sendResult: { success: boolean; error?: string; usedInstanceId?: string };
        
        if (channelType === 'sms') {
          // Send via SMS
          sendResult = await sendViaSms(msg, lead, normalizedPhone);
        } else {
          // Use the fallback system to send via WhatsApp
          sendResult = await sendWithFallback(msg, lead, normalizedPhone);
        }

        if (sendResult.success) {
          await supabase
            .from("lead_scheduled_messages")
            .update({ 
              status: "sent", 
              sent_at: new Date().toISOString(),
              whatsapp_instance_id: sendResult.usedInstanceId || msg.whatsapp_instance_id,
              updated_at: new Date().toISOString()
            })
            .eq("id", msg.id);
          sentCount++;
          console.log(`Message ${msg.id} sent successfully via instance ${sendResult.usedInstanceId}`);
        } else {
          // Check if it's a permanent failure (phone issue) or retryable
          const isPermanentFailure = sendResult.error?.includes("Bad Request") || 
                                     sendResult.error?.includes("Telefone inválido") ||
                                     sendResult.error?.includes("número não registrado");
          
          if (isPermanentFailure || attemptCount >= (msg.max_attempts || 3)) {
            await supabase
              .from("lead_scheduled_messages")
              .update({ 
                status: "failed_other", 
                failure_reason: sendResult.error || "Erro desconhecido ao enviar",
                updated_at: new Date().toISOString()
              })
              .eq("id", msg.id);
            failedCount++;
            console.error(`Message ${msg.id} failed permanently: ${sendResult.error}`);
          } else {
            // Reschedule for retry in 5 minutes
            const retryAt = new Date();
            retryAt.setMinutes(retryAt.getMinutes() + 5);
            
            await supabase
              .from("lead_scheduled_messages")
              .update({ 
                scheduled_at: retryAt.toISOString(),
                failure_reason: `Tentativa ${attemptCount}: ${sendResult.error}`,
                updated_at: new Date().toISOString()
              })
              .eq("id", msg.id);
            console.warn(`Message ${msg.id} rescheduled for retry at ${retryAt.toISOString()}`);
          }
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
