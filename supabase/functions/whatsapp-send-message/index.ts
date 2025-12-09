import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WASENDERAPI_TOKEN = Deno.env.get("WASENDERAPI_TOKEN");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, instanceId, content, messageType = "text", mediaUrl, mediaCaption } = await req.json();

    console.log("=== WhatsApp Send Message ===");
    console.log("ConversationId:", conversationId);
    console.log("InstanceId:", instanceId);
    console.log("Content:", content?.substring(0, 50));

    if (!conversationId || !instanceId) {
      throw new Error("conversationId and instanceId are required");
    }

    // Get instance
    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instanceId)
      .single();

    if (instanceError || !instance) {
      throw new Error("Instance not found");
    }

    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      throw new Error("Conversation not found");
    }

    const phone = conversation.phone_number;
    let messageSent = false;
    let externalMessageId = null;

    // Send via appropriate provider
    if (instance.provider === "wasenderapi") {
      if (!instance.wasender_api_key) {
        throw new Error("WasenderAPI not configured for this instance");
      }

      console.log("Sending via WasenderAPI...");

      // Format phone for WasenderAPI (with + prefix)
      const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;

      // Check if mediaUrl is base64 data - need to upload first
      let uploadedImageUrl = mediaUrl;
      
      if (messageType === "image" && mediaUrl && mediaUrl.startsWith("data:")) {
        console.log("Uploading base64 image to WasenderAPI...");
        
        // Upload image first
        const uploadResponse = await fetch("https://www.wasenderapi.com/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${instance.wasender_api_key}`,
          },
          body: JSON.stringify({
            file: mediaUrl,
          }),
        });

        const uploadText = await uploadResponse.text();
        console.log("Upload response:", uploadResponse.status, uploadText);

        if (uploadResponse.ok) {
          try {
            const uploadData = JSON.parse(uploadText);
            if (uploadData.success && uploadData.data?.publicUrl) {
              uploadedImageUrl = uploadData.data.publicUrl;
              console.log("Image uploaded successfully:", uploadedImageUrl);
            } else if (uploadData.data?.url) {
              uploadedImageUrl = uploadData.data.url;
              console.log("Image uploaded successfully:", uploadedImageUrl);
            }
          } catch (e) {
            console.error("Failed to parse upload response");
          }
        } else {
          console.error("Image upload failed:", uploadText);
          throw new Error("Falha ao enviar imagem");
        }
      }

      // WasenderAPI uses a single endpoint for all message types
      const endpoint = "https://www.wasenderapi.com/api/send-message";
      const payload: any = {
        to: formattedPhone,
      };

      // WasenderAPI requires "text" field for text messages
      if (messageType === "text" && content) {
        payload.text = content;
      } else if (messageType === "image" && uploadedImageUrl) {
        payload.imageUrl = uploadedImageUrl;
        if (content || mediaCaption) {
          payload.text = mediaCaption || content;
        }
      } else if (messageType === "audio" && mediaUrl) {
        // Audio needs upload too if base64
        if (mediaUrl.startsWith("data:")) {
          console.log("Uploading base64 audio to WasenderAPI...");
          const uploadResponse = await fetch("https://www.wasenderapi.com/api/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${instance.wasender_api_key}`,
            },
            body: JSON.stringify({ file: mediaUrl }),
          });
          const uploadText = await uploadResponse.text();
          if (uploadResponse.ok) {
            try {
              const uploadData = JSON.parse(uploadText);
              payload.audioUrl = uploadData.data?.publicUrl || uploadData.data?.url || mediaUrl;
            } catch (e) {
              payload.audioUrl = mediaUrl;
            }
          }
        } else {
          payload.audioUrl = mediaUrl;
        }
      } else if (messageType === "document" && mediaUrl) {
        payload.documentUrl = mediaUrl;
        if (mediaCaption) {
          payload.text = mediaCaption;
        }
      } else if (messageType === "video" && mediaUrl) {
        payload.videoUrl = mediaUrl;
        if (content || mediaCaption) {
          payload.text = mediaCaption || content;
        }
      }
      
      // Validate we have something to send
      if (!payload.text && !payload.imageUrl && !payload.audioUrl && !payload.documentUrl && !payload.videoUrl) {
        throw new Error("Message content is required");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${instance.wasender_api_key}`,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log("WasenderAPI response:", response.status, responseText);

      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          if (data.success) {
            messageSent = true;
            externalMessageId = data.data?.id || data.data?.messageId;
          }
        } catch (e) {
          console.error("Failed to parse WasenderAPI response");
        }
      }

      if (!messageSent) {
        console.error("WasenderAPI send failed:", responseText);
      }
    }
    // Z-API fallback
    else if (instance.provider === "zapi") {
      if (!instance.z_api_instance_id || !instance.z_api_token) {
        throw new Error("Z-API not configured for this instance");
      }

      console.log("Sending via Z-API...");

      const zapiPhone = phone.includes("@") ? phone : `${phone}@c.us`;
      const zapiUrl = `https://api.z-api.io/instances/${instance.z_api_instance_id}/token/${instance.z_api_token}/send-text`;

      const response = await fetch(zapiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": instance.z_api_client_token || "",
        },
        body: JSON.stringify({
          phone: zapiPhone.replace("@c.us", ""),
          message: content,
        }),
      });

      const responseText = await response.text();
      console.log("Z-API response:", response.status, responseText);

      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          messageSent = true;
          externalMessageId = data.messageId || data.id;
        } catch (e) {
          console.error("Failed to parse Z-API response");
        }
      }
    }

    // Save message to database regardless of send status
    const { data: savedMessage, error: saveError } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversationId,
        instance_id: instanceId,
        content: content,
        direction: "outbound",
        message_type: messageType,
        media_url: mediaUrl || null,
        media_caption: mediaCaption || null,
        z_api_message_id: externalMessageId,
        status: messageSent ? "sent" : "failed",
        is_from_bot: false,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving message:", saveError);
    }

    // Update conversation
    await supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: 0, // Reset unread when user sends message
      })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({
        success: messageSent,
        message: savedMessage,
        externalMessageId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Send message error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
