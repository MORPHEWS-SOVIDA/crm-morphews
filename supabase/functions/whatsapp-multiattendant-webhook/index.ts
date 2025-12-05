import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Normalize Brazilian phone number
function normalizePhone(phone: string): string {
  const clean = phone.replace(/\D/g, "").replace("@c.us", "").replace("@s.whatsapp.net", "");
  
  // Add country code if missing
  if (!clean.startsWith("55") && clean.length <= 11) {
    return "55" + clean;
  }
  
  return clean;
}

// Find instance by different provider IDs
async function findInstance(identifier: string, provider?: string) {
  console.log("Finding instance by identifier:", identifier, "provider:", provider);
  
  // Try WasenderAPI first
  if (provider === "wasenderapi" || !provider) {
    // WasenderAPI sends the api_key as sessionId in webhooks
    const { data: wasenderByApiKey } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("wasender_api_key", identifier)
      .single();

    if (wasenderByApiKey) {
      console.log("Found instance by wasender_api_key:", wasenderByApiKey.id);
      return wasenderByApiKey;
    }

    // Try by session ID (numeric)
    const { data: wasenderInstance } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("wasender_session_id", identifier)
      .single();

    if (wasenderInstance) {
      console.log("Found instance by wasender_session_id:", wasenderInstance.id);
      return wasenderInstance;
    }

    // Try by internal ID
    const { data: byId } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", identifier)
      .single();

    if (byId) {
      console.log("Found instance by id:", byId.id);
      return byId;
    }
  }

  // Try Z-API
  const { data: zapiInstance } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("z_api_instance_id", identifier)
    .single();

  if (zapiInstance) {
    console.log("Found instance by z_api_instance_id:", zapiInstance.id);
    return zapiInstance;
  }

  console.error("Instance not found:", identifier);
  return null;
}

// Try to find existing lead by phone number
async function findLeadByPhone(organizationId: string, phone: string) {
  const normalizedPhone = normalizePhone(phone);
  
  // Generate possible phone formats
  const variants = [
    normalizedPhone,
    normalizedPhone.replace("55", ""),
    normalizedPhone.length === 13 ? normalizedPhone.slice(0, 4) + normalizedPhone.slice(5) : null,
    normalizedPhone.length === 12 ? normalizedPhone.slice(0, 4) + "9" + normalizedPhone.slice(4) : null,
  ].filter(Boolean);

  for (const variant of variants) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, name, whatsapp")
      .eq("organization_id", organizationId)
      .or(`whatsapp.ilike.%${variant}%,secondary_phone.ilike.%${variant}%`)
      .limit(1)
      .single();

    if (lead) return lead;
  }

  return null;
}

// Get or create conversation
async function getOrCreateConversation(
  instanceId: string,
  organizationId: string,
  phoneNumber: string,
  contactName?: string,
  contactProfilePic?: string
) {
  const normalizedPhone = normalizePhone(phoneNumber);
  
  // Try to find existing conversation
  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("instance_id", instanceId)
    .eq("phone_number", normalizedPhone)
    .single();

  if (existing) {
    // Update contact info if available
    if (contactName || contactProfilePic) {
      await supabase
        .from("whatsapp_conversations")
        .update({
          contact_name: contactName || existing.contact_name,
          contact_profile_pic: contactProfilePic || existing.contact_profile_pic,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
    return existing;
  }

  // Try to find matching lead
  const lead = await findLeadByPhone(organizationId, normalizedPhone);

  // Create new conversation
  const { data: newConversation, error } = await supabase
    .from("whatsapp_conversations")
    .insert({
      instance_id: instanceId,
      organization_id: organizationId,
      phone_number: normalizedPhone,
      contact_name: contactName || lead?.name || null,
      contact_profile_pic: contactProfilePic || null,
      lead_id: lead?.id || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating conversation:", error);
    throw error;
  }

  return newConversation;
}

// Check if message already exists to avoid duplicates
async function messageExists(conversationId: string, messageId: string) {
  if (!messageId) return false;
  
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("z_api_message_id", messageId)
    .single();
  
  return !!data;
}

// Save message to database
async function saveMessage(
  conversationId: string,
  instanceId: string,
  content: string | null,
  direction: "inbound" | "outbound",
  messageType: string,
  messageId?: string,
  mediaUrl?: string,
  mediaCaption?: string,
  isFromBot = false
) {
  // Check for duplicates
  if (messageId && await messageExists(conversationId, messageId)) {
    console.log("Message already exists, skipping:", messageId);
    return null;
  }

  // Status must be: sent, delivered, read, or failed (constraint)
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .insert({
      conversation_id: conversationId,
      instance_id: instanceId,
      content,
      direction,
      message_type: messageType,
      z_api_message_id: messageId || null,
      media_url: mediaUrl || null,
      media_caption: mediaCaption || null,
      is_from_bot: isFromBot,
      status: direction === "outbound" ? "sent" : "delivered",
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving message:", error);
    throw error;
  }

  // Update conversation last_message_at and unread count
  const updateData: any = {
    last_message_at: new Date().toISOString(),
  };

  if (direction === "inbound") {
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .select("unread_count")
      .eq("id", conversationId)
      .single();

    updateData.unread_count = (conv?.unread_count || 0) + 1;
  }

  await supabase
    .from("whatsapp_conversations")
    .update(updateData)
    .eq("id", conversationId);

  console.log("Message saved successfully:", data?.id);
  return data;
}

// Process WasenderAPI message payload - handles both messages.received and messages.upsert
async function processWasenderMessage(instance: any, body: any) {
  const msgData = body.data?.messages?.[0] || body.data?.message || body.data;
  
  if (!msgData) {
    console.log("No message data in payload");
    return null;
  }

  // Check if fromMe (our own message) - skip if already saved by send function
  const isFromMe = msgData.key?.fromMe || msgData.fromMe || false;
  
  // Extract phone from various possible fields
  const remoteJid = msgData.key?.remoteJid || msgData.remoteJid || "";
  const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "") ||
               msgData.key?.cleanedSenderPn ||
               msgData.from || 
               msgData.phone || "";
  
  // Extract message content from various WasenderAPI formats
  const text = msgData.messageBody || 
              msgData.body ||
              msgData.text ||
              msgData.message?.conversation || 
              msgData.message?.extendedTextMessage?.text ||
              msgData.message?.imageMessage?.caption ||
              msgData.message?.videoMessage?.caption ||
              "";
  
  const messageId = msgData.key?.id || msgData.id || msgData.messageId || "";
  const isGroup = remoteJid.includes("@g.us") || msgData.isGroup || false;
  const senderName = msgData.pushName || msgData.senderName || msgData.name || "";
  
  // Determine message type
  let messageType = "text";
  if (msgData.message?.imageMessage || msgData.type === "image") messageType = "image";
  else if (msgData.message?.audioMessage || msgData.type === "audio") messageType = "audio";
  else if (msgData.message?.videoMessage || msgData.type === "video") messageType = "video";
  else if (msgData.message?.documentMessage || msgData.type === "document") messageType = "document";
  else if (msgData.message?.stickerMessage) messageType = "sticker";
  
  const mediaUrl = msgData.mediaUrl || 
                  msgData.message?.imageMessage?.url ||
                  msgData.message?.audioMessage?.url ||
                  msgData.message?.videoMessage?.url ||
                  msgData.message?.documentMessage?.url ||
                  null;
  const caption = msgData.message?.imageMessage?.caption || 
                 msgData.message?.videoMessage?.caption ||
                 msgData.caption || 
                 null;

  console.log("Parsed WasenderAPI message:", { 
    phone, 
    text: text?.substring(0, 50), 
    messageId, 
    senderName,
    isFromMe,
    messageType 
  });

  if (!phone) {
    console.log("No phone number in message");
    return null;
  }

  // Skip group messages
  if (isGroup) {
    console.log("Group message, skipping...");
    return null;
  }

  // Get or create conversation
  const conversation = await getOrCreateConversation(
    instance.id,
    instance.organization_id,
    phone,
    senderName
  );

  // Save the message
  const direction = isFromMe ? "outbound" : "inbound";
  const savedMessage = await saveMessage(
    conversation.id,
    instance.id,
    text || caption || null,
    direction,
    messageType,
    messageId,
    mediaUrl,
    caption
  );

  console.log("WasenderAPI message processed:", {
    conversationId: conversation.id,
    from: phone,
    direction,
    text: text?.substring(0, 50),
    saved: !!savedMessage
  });

  return savedMessage;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("=== WhatsApp Multiattendant Webhook ===");
    console.log("Payload:", JSON.stringify(body, null, 2));

    // Detect provider from webhook payload structure
    let provider = "unknown";
    let instanceIdentifier = "";
    
    // WasenderAPI webhook format - check for sessionId (api_key) or event patterns
    if (body.sessionId || body.session_id || body.event?.startsWith("messages.") || body.event?.startsWith("session.")) {
      provider = "wasenderapi";
      // WasenderAPI sends api_key as sessionId in webhooks
      instanceIdentifier = String(body.sessionId || body.session_id || "");
      console.log("WasenderAPI webhook detected - sessionId (api_key):", instanceIdentifier);
    }
    // Z-API webhook format
    else if (body.instanceId || req.headers.get("x-instance-id")) {
      provider = "zapi";
      instanceIdentifier = body.instanceId || req.headers.get("x-instance-id") || "";
      console.log("Z-API webhook detected - instanceId:", instanceIdentifier);
    }
    
    console.log("Provider detected:", provider);
    console.log("Instance identifier:", instanceIdentifier);

    if (!instanceIdentifier) {
      console.log("No instance ID provided, ignoring webhook...");
      return new Response(JSON.stringify({ status: "ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find our instance
    const instance = await findInstance(instanceIdentifier, provider);
    if (!instance) {
      console.log("Instance not found:", instanceIdentifier);
      return new Response(JSON.stringify({ status: "instance_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Instance found:", instance.name, instance.id, "provider:", instance.provider);

    // Handle WasenderAPI webhooks
    if (provider === "wasenderapi" || instance.provider === "wasenderapi") {
      const event = body.event;
      console.log("WasenderAPI event:", event);
      
      switch (event) {
        case "messages.received":
        case "messages.upsert": {
          // Process incoming or upserted messages
          const result = await processWasenderMessage(instance, body);
          return new Response(JSON.stringify({ 
            status: result ? "message_saved" : "message_skipped" 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        case "messages.update":
        case "messages.ack": {
          const messageId = body.data?.key?.id || body.data?.id || body.data?.messageId;
          const status = body.data?.status || body.data?.ack;

          if (messageId) {
            // Map WasenderAPI status codes to our status values
            const statusMap: Record<string, string> = {
              "sent": "sent",
              "delivered": "delivered",
              "read": "read",
              "0": "sent",
              "1": "sent",
              "2": "delivered",
              "3": "read",
              "4": "read", // Status 4 = played (for audio) or read
            };

            const newStatus = statusMap[String(status)] || "delivered";

            await supabase
              .from("whatsapp_messages")
              .update({ status: newStatus })
              .eq("z_api_message_id", messageId);

            console.log("Message status updated:", messageId, newStatus);
          }

          return new Response(JSON.stringify({ status: "status_updated" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        case "session.status": {
          const status = body.data?.status;
          const phone = body.data?.phone_number;

          if (status === "connected" || status === "ready") {
            await supabase
              .from("whatsapp_instances")
              .update({
                is_connected: true,
                phone_number: phone,
                status: "active",
                qr_code_base64: null,
              })
              .eq("id", instance.id);

            console.log("WasenderAPI instance connected:", instance.name, phone);
          } else if (status === "disconnected" || status === "qr" || status === "NEED_SCAN") {
            await supabase
              .from("whatsapp_instances")
              .update({
                is_connected: false,
                status: status === "NEED_SCAN" ? "pending" : "disconnected",
              })
              .eq("id", instance.id);

            console.log("WasenderAPI instance status:", instance.name, status);
          }

          return new Response(JSON.stringify({ status: "status_handled" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        default:
          console.log("Unknown WasenderAPI event:", event);
      }
    }

    // Handle Z-API webhooks (legacy)
    const webhookType = body.type || body.event;

    switch (webhookType) {
      case "ReceivedCallback":
      case "message":
      case "received": {
        const phone = body.phone || body.from?.replace("@c.us", "");
        const text = body.text?.message || body.body || body.message || "";
        const messageId = body.messageId || body.id;
        const isGroup = body.isGroup || false;
        const senderName = body.senderName || body.pushName || body.notifyName;
        const senderPhoto = body.senderPhoto || body.profilePicUrl;
        const messageType = body.type || "text";
        const mediaUrl = body.image?.imageUrl || body.audio?.audioUrl || body.video?.videoUrl || body.document?.documentUrl;
        const caption = body.caption;

        if (!phone) {
          console.log("No phone number in message");
          return new Response(JSON.stringify({ status: "no_phone" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (isGroup) {
          console.log("Group message, skipping...");
          return new Response(JSON.stringify({ status: "group_ignored" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const conversation = await getOrCreateConversation(
          instance.id,
          instance.organization_id,
          phone,
          senderName,
          senderPhoto
        );

        await saveMessage(
          conversation.id,
          instance.id,
          text || null,
          "inbound",
          messageType,
          messageId,
          mediaUrl,
          caption
        );

        console.log("Z-API message saved:", {
          conversationId: conversation.id,
          from: phone,
          text: text?.substring(0, 50),
        });

        return new Response(JSON.stringify({ status: "message_saved" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "MessageStatusCallback":
      case "status":
      case "ack": {
        const messageId = body.messageId || body.id;
        const status = body.status || body.ack;

        if (messageId) {
          const statusMap: Record<string, string> = {
            "SENT": "sent",
            "RECEIVED": "delivered",
            "READ": "read",
            "PLAYED": "read",
            "1": "sent",
            "2": "delivered",
            "3": "read",
            "4": "read",
          };

          const newStatus = statusMap[String(status)] || status;

          if (newStatus) {
            await supabase
              .from("whatsapp_messages")
              .update({ status: newStatus })
              .eq("z_api_message_id", messageId);

            console.log("Z-API Message status updated:", messageId, newStatus);
          }
        }

        return new Response(JSON.stringify({ status: "status_updated" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "ConnectedCallback":
      case "connected": {
        const phone = body.phone || body.phoneNumber;

        await supabase
          .from("whatsapp_instances")
          .update({
            is_connected: true,
            phone_number: phone,
            status: "active",
            qr_code_base64: null,
          })
          .eq("id", instance.id);

        console.log("Z-API instance connected:", instance.name, phone);

        return new Response(JSON.stringify({ status: "connected" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "DisconnectedCallback":
      case "disconnected": {
        await supabase
          .from("whatsapp_instances")
          .update({
            is_connected: false,
            status: "disconnected",
          })
          .eq("id", instance.id);

        console.log("Z-API instance disconnected:", instance.name);

        return new Response(JSON.stringify({ status: "disconnected" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("Unhandled webhook type:", webhookType);
    return new Response(JSON.stringify({ status: "ignored" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
