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
  const clean = phone.replace(/\D/g, "").replace("@c.us", "");
  
  // Add country code if missing
  if (!clean.startsWith("55") && clean.length <= 11) {
    return "55" + clean;
  }
  
  return clean;
}

// Find instance by Z-API instance ID
async function findInstance(zapiInstanceId: string) {
  const { data, error } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("z_api_instance_id", zapiInstanceId)
    .single();

  if (error) {
    console.error("Instance not found:", zapiInstanceId, error);
    return null;
  }
  
  return data;
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

  // Create new conversation
  const { data: newConversation, error } = await supabase
    .from("whatsapp_conversations")
    .insert({
      instance_id: instanceId,
      organization_id: organizationId,
      phone_number: normalizedPhone,
      contact_name: contactName || null,
      contact_profile_pic: contactProfilePic || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating conversation:", error);
    throw error;
  }

  return newConversation;
}

// Save message to database
async function saveMessage(
  conversationId: string,
  instanceId: string,
  content: string | null,
  direction: "inbound" | "outbound",
  messageType: string,
  zapiMessageId?: string,
  mediaUrl?: string,
  mediaCaption?: string,
  isFromBot = false
) {
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .insert({
      conversation_id: conversationId,
      instance_id: instanceId,
      content,
      direction,
      message_type: messageType,
      z_api_message_id: zapiMessageId || null,
      media_url: mediaUrl || null,
      media_caption: mediaCaption || null,
      is_from_bot: isFromBot,
      status: direction === "outbound" ? "sent" : "received",
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

  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("=== WhatsApp Multiattendant Webhook ===");
    console.log("Payload:", JSON.stringify(body, null, 2));

    // Get Z-API instance ID from header or body
    const zapiInstanceId = req.headers.get("x-instance-id") || body.instanceId;
    
    if (!zapiInstanceId) {
      console.log("No instance ID provided, ignoring...");
      return new Response(JSON.stringify({ status: "ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find our instance
    const instance = await findInstance(zapiInstanceId);
    if (!instance) {
      console.log("Instance not found:", zapiInstanceId);
      return new Response(JSON.stringify({ status: "instance_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Instance found:", instance.name, instance.id);

    // Handle different webhook types
    const webhookType = body.type || body.event;

    switch (webhookType) {
      case "ReceivedCallback":
      case "message":
      case "received": {
        // Incoming message
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

        // Skip group messages for now
        if (isGroup) {
          console.log("Group message, skipping...");
          return new Response(JSON.stringify({ status: "group_ignored" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get or create conversation
        const conversation = await getOrCreateConversation(
          instance.id,
          instance.organization_id,
          phone,
          senderName,
          senderPhoto
        );

        // Save the message
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

        console.log("Message saved:", {
          conversationId: conversation.id,
          from: phone,
          text: text?.substring(0, 50),
        });

        // TODO: Check if bot is enabled for this instance and process with AI

        return new Response(JSON.stringify({ status: "message_saved" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "MessageStatusCallback":
      case "ack":
      case "status": {
        // Message status update (sent, delivered, read)
        const messageId = body.messageId || body.id;
        const status = body.status || body.ack;

        if (messageId) {
          const statusMap: Record<string, string> = {
            1: "sent",
            2: "delivered",
            3: "read",
            4: "played", // for audio
          };

          const newStatus = typeof status === "number" ? statusMap[status] : status;

          if (newStatus) {
            await supabase
              .from("whatsapp_messages")
              .update({ status: newStatus })
              .eq("z_api_message_id", messageId);

            console.log("Message status updated:", messageId, newStatus);
          }
        }

        return new Response(JSON.stringify({ status: "status_updated" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "connected":
      case "ready": {
        // WhatsApp connected
        const phone = body.phone || body.wid?.replace("@c.us", "");

        await supabase
          .from("whatsapp_instances")
          .update({
            is_connected: true,
            phone_number: phone,
            status: "active",
            qr_code_base64: null,
          })
          .eq("id", instance.id);

        console.log("Instance connected:", instance.name, phone);

        return new Response(JSON.stringify({ status: "connected" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnected":
      case "qr": {
        // WhatsApp disconnected or needs QR
        await supabase
          .from("whatsapp_instances")
          .update({
            is_connected: false,
            status: webhookType === "qr" ? "pending" : "disconnected",
            qr_code_base64: body.qrCode || body.base64Qr || null,
          })
          .eq("id", instance.id);

        console.log("Instance status changed:", instance.name, webhookType);

        return new Response(JSON.stringify({ status: webhookType }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        console.log("Unknown webhook type:", webhookType);
        return new Response(JSON.stringify({ status: "unknown_type" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
