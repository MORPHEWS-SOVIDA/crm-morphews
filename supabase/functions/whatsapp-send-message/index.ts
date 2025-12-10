import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      conversationId, 
      instanceId, 
      content, 
      messageType = "text", 
      mediaUrl, 
      mediaCaption,
      mediaBase64,
      mediaMimeType 
    } = await req.json();

    console.log("=== WhatsApp Send Message ===");
    console.log("ConversationId:", conversationId);
    console.log("InstanceId:", instanceId);
    console.log("Content:", content?.substring(0, 50));
    console.log("MessageType:", messageType);
    console.log("Has mediaBase64:", !!mediaBase64);
    console.log("MediaMimeType:", mediaMimeType);

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

    // Get conversation with sendable_phone
    const { data: conversation, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      throw new Error("Conversation not found");
    }

    // CRITICAL: Use sendable_phone for sending, fallback to phone_number
    // sendable_phone contains the actual E.164 phone number
    // phone_number may contain LID format which doesn't work for sending
    let phone = conversation.sendable_phone || conversation.phone_number;
    
    console.log("Using phone for send:", phone);
    console.log("sendable_phone:", conversation.sendable_phone);
    console.log("phone_number:", conversation.phone_number);
    
    // Validate we have a sendable phone
    if (!phone || phone.length < 8) {
      throw new Error("Número de telefone inválido para envio. O contato pode não ter um número real associado.");
    }

    let messageSent = false;
    let externalMessageId = null;

    // Send via appropriate provider
    if (instance.provider === "wasenderapi") {
      if (!instance.wasender_api_key) {
        throw new Error("WasenderAPI not configured for this instance");
      }

      console.log("Sending via WasenderAPI...");

      // Format phone for WasenderAPI (with + prefix)
      // Remove any existing + and add it back to ensure correct format
      const cleanPhone = phone.replace(/\D/g, "");
      const formattedPhone = `+${cleanPhone}`;
      
      console.log("Formatted phone:", formattedPhone);

      // Check if we have mediaBase64 to upload
      let uploadedMediaUrl = mediaUrl;
      
      if (mediaBase64 && mediaMimeType) {
        console.log("Uploading base64 media to WasenderAPI...");
        
        // Construct the proper data URL for WasenderAPI upload
        const dataUrl = `data:${mediaMimeType};base64,${mediaBase64}`;
        
        const uploadResponse = await fetch("https://www.wasenderapi.com/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${instance.wasender_api_key}`,
          },
          body: JSON.stringify({ file: dataUrl }),
        });

        const uploadText = await uploadResponse.text();
        console.log("Upload response status:", uploadResponse.status);

        if (uploadResponse.ok) {
          try {
            const uploadData = JSON.parse(uploadText);
            uploadedMediaUrl = uploadData.data?.publicUrl || uploadData.data?.url;
            console.log("Media uploaded successfully:", uploadedMediaUrl);
            
            if (!uploadedMediaUrl) {
              console.error("Upload response missing URL:", uploadText);
              throw new Error("Falha ao obter URL da mídia enviada");
            }
          } catch (e) {
            console.error("Failed to parse upload response:", uploadText);
            throw new Error("Falha ao processar upload de mídia");
          }
        } else {
          console.error("Media upload failed:", uploadText);
          throw new Error("Falha ao enviar mídia para WasenderAPI");
        }
      }

      // Build payload based on message type
      const payload: any = { to: formattedPhone };

      if (messageType === "text" && content) {
        payload.text = content;
      } else if (messageType === "image" && uploadedMediaUrl) {
        payload.imageUrl = uploadedMediaUrl;
        if (content || mediaCaption) {
          payload.text = mediaCaption || content;
        }
      } else if (messageType === "audio" && uploadedMediaUrl) {
        payload.audioUrl = uploadedMediaUrl;
      } else if (messageType === "document" && uploadedMediaUrl) {
        payload.documentUrl = uploadedMediaUrl;
        if (mediaCaption) {
          payload.text = mediaCaption;
        }
      } else if (messageType === "video" && uploadedMediaUrl) {
        payload.videoUrl = uploadedMediaUrl;
        if (content || mediaCaption) {
          payload.text = mediaCaption || content;
        }
      }
      
      // Validate we have something to send
      if (!payload.text && !payload.imageUrl && !payload.audioUrl && !payload.documentUrl && !payload.videoUrl) {
        throw new Error("Conteúdo da mensagem é obrigatório");
      }

      console.log("Sending payload:", JSON.stringify({ ...payload, to: formattedPhone }));

      const response = await fetch("https://www.wasenderapi.com/api/send-message", {
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
            externalMessageId = data.data?.id || data.data?.messageId || data.data?.key?.id;
          } else {
            console.error("WasenderAPI returned success=false:", data.message);
          }
        } catch (e) {
          console.error("Failed to parse WasenderAPI response");
        }
      } else {
        // Parse error message for user-friendly feedback
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.message?.includes("JID does not exist")) {
            throw new Error("Este número não existe no WhatsApp. Verifique se o número está correto.");
          }
          console.error("WasenderAPI error:", errorData);
        } catch (e) {
          console.error("WasenderAPI send failed:", responseText);
        }
      }
    }
    // Z-API 
    else if (instance.provider === "zapi") {
      if (!instance.z_api_instance_id || !instance.z_api_token) {
        throw new Error("Z-API not configured for this instance");
      }

      console.log("Sending via Z-API...");

      const cleanPhone = phone.replace(/\D/g, "").replace("@c.us", "").replace("@s.whatsapp.net", "");
      const zapiUrl = `https://api.z-api.io/instances/${instance.z_api_instance_id}/token/${instance.z_api_token}/send-text`;

      const response = await fetch(zapiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": instance.z_api_client_token || "",
        },
        body: JSON.stringify({
          phone: cleanPhone,
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

    // Save message to database
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
        unread_count: 0,
      })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({
        success: messageSent,
        message: savedMessage,
        externalMessageId,
        error: !messageSent ? "Falha ao enviar mensagem. Verifique se o número está correto." : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Send message error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
