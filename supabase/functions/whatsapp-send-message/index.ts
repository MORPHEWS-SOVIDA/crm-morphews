import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalizePhoneE164(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (!clean) return "";
  if (!clean.startsWith("55") && clean.length <= 11) {
    clean = "55" + clean;
  }
  return clean;
}

/**
 * Upload base64 para Supabase Storage e retorna URL pública
 */
/**
 * Upload base64 para Supabase Storage e retorna URL pública
 * Suporta data:mime;base64,... OU base64 puro
 */
async function uploadBase64ToStorage(
  base64Input: string,
  mimeTypeHint: string,
  organizationId: string,
  conversationId: string
): Promise<string | null> {
  try {
    let base64Data = base64Input;
    let mimeType = mimeTypeHint || "application/octet-stream";

    // Se vier como data URL, extrair base64 e mime
    if (base64Input.startsWith("data:")) {
      const match = base64Input.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        // Formato diferente, tentar extrair só o base64
        const parts = base64Input.split(",");
        if (parts.length > 1) {
          base64Data = parts[1];
        }
      }
    }

    console.log("Upload base64 to storage. MimeType:", mimeType, "Length:", base64Data.length);

    // Determinar extensão
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "audio/ogg": "ogg",
      "audio/ogg; codecs=opus": "ogg",
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/mp4": "m4a",
      "audio/webm": "webm",
      "audio/wav": "wav",
      "video/mp4": "mp4",
      "application/pdf": "pdf",
    };
    const ext = extMap[mimeType.split(";")[0]] || "bin";
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = `org/${organizationId}/conv/${conversationId}/${fileName}`;

    // Decodificar base64
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log("Uploading to storage:", filePath, "Size:", bytes.length);

    // Upload para storage
    const { data, error } = await supabase.storage
      .from("whatsapp-media")
      .upload(filePath, bytes, {
        contentType: mimeType.split(";")[0],
        upsert: true,
      });

    if (error) {
      console.error("Storage upload error:", error);
      return null;
    }

    // Gerar URL pública
    const { data: publicUrlData } = supabase.storage.from("whatsapp-media").getPublicUrl(filePath);
    const publicUrl = publicUrlData.publicUrl;
    console.log("Uploaded to storage, public URL:", publicUrl);
    return publicUrl;
  } catch (e) {
    console.error("Upload error:", e);
    return null;
  }
}

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

    if (!conversationId) {
      throw new Error("conversationId is required");
    }

    // Get conversation (NOVA LÓGICA: pode não ter instanceId, usa current_instance_id)
    const { data: conversation, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select("*, current_instance_id")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      throw new Error("Conversation not found");
    }

    // Determinar qual instância usar
    const effectiveInstanceId = instanceId || conversation.current_instance_id || conversation.instance_id;
    
    if (!effectiveInstanceId) {
      throw new Error("Nenhuma instância disponível para envio");
    }

    // Get instance
    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", effectiveInstanceId)
      .single();

    if (instanceError || !instance) {
      throw new Error("Instance not found");
    }

    // CRITICAL: Use sendable_phone for sending
    let phone = conversation.sendable_phone || conversation.phone_number;
    phone = normalizePhoneE164(phone);
    
    console.log("Using phone:", phone);
    
    if (!phone || phone.length < 8) {
      throw new Error("Número de telefone inválido para envio");
    }

    let messageSent = false;
    let providerMessageId = null;

    // Send via WasenderAPI
    if (instance.provider === "wasenderapi") {
      if (!instance.wasender_api_key) {
        throw new Error("WasenderAPI not configured");
      }

      console.log("Sending via WasenderAPI...");

      const formattedPhone = `+${phone}`;
      let uploadedMediaUrl: string | null = null;
      
      // Se tem mediaUrl que começa com data:, é base64 e precisa upload
      if (mediaUrl && mediaUrl.startsWith("data:")) {
        console.log("MediaUrl is data URL, uploading to storage...");
        uploadedMediaUrl = await uploadBase64ToStorage(mediaUrl, mediaMimeType || "", conversation.organization_id, conversationId);
      }
      // Se tem base64 separado
      else if (mediaBase64) {
        console.log("Processing mediaBase64...");
        const dataUrlToUpload = mediaMimeType 
          ? `data:${mediaMimeType};base64,${mediaBase64}` 
          : mediaBase64;
        uploadedMediaUrl = await uploadBase64ToStorage(dataUrlToUpload, mediaMimeType || "", conversation.organization_id, conversationId);
      }
      // Já é uma URL http/https
      else if (mediaUrl && (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://"))) {
        uploadedMediaUrl = mediaUrl;
      }

      // Validação final para mensagens de mídia
      if ((messageType === "image" || messageType === "audio" || messageType === "video" || messageType === "document") && !uploadedMediaUrl) {
        console.error("Media message but no valid URL after processing");
        throw new Error("Falha ao processar mídia para envio");
      }

      console.log("Final uploadedMediaUrl:", uploadedMediaUrl);

      // Build payload
      const payload: any = { to: formattedPhone };

      if (messageType === "text" && content) {
        payload.text = content;
      } else if (messageType === "image" && uploadedMediaUrl) {
        payload.imageUrl = uploadedMediaUrl;
        if (content || mediaCaption) payload.text = mediaCaption || content;
      } else if (messageType === "audio" && uploadedMediaUrl) {
        payload.audioUrl = uploadedMediaUrl;
      } else if (messageType === "document" && uploadedMediaUrl) {
        payload.documentUrl = uploadedMediaUrl;
        if (mediaCaption) payload.text = mediaCaption;
      } else if (messageType === "video" && uploadedMediaUrl) {
        payload.videoUrl = uploadedMediaUrl;
        if (content || mediaCaption) payload.text = mediaCaption || content;
      }
      
      if (!payload.text && !payload.imageUrl && !payload.audioUrl && !payload.documentUrl && !payload.videoUrl) {
        throw new Error("Conteúdo da mensagem é obrigatório");
      }

      console.log("Sending payload:", JSON.stringify(payload));

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
            providerMessageId = data.data?.id || data.data?.messageId || data.data?.key?.id;
          } else {
            console.error("WasenderAPI error:", data.message);
          }
        } catch (e) {
          console.error("Parse error");
        }
      } else {
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.message?.includes("JID does not exist")) {
            throw new Error("Este número não existe no WhatsApp");
          }
        } catch (e) {}
      }
    }
    // Z-API
    else if (instance.provider === "zapi") {
      if (!instance.z_api_instance_id || !instance.z_api_token) {
        throw new Error("Z-API not configured");
      }

      const zapiUrl = `https://api.z-api.io/instances/${instance.z_api_instance_id}/token/${instance.z_api_token}/send-text`;

      const response = await fetch(zapiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": instance.z_api_client_token || "",
        },
        body: JSON.stringify({ phone, message: content }),
      });

      if (response.ok) {
        const data = await response.json();
        messageSent = true;
        providerMessageId = data.messageId || data.id;
      }
    }

    // Save message to database
    const { data: savedMessage, error: saveError } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversationId,
        instance_id: effectiveInstanceId,
        content: content,
        direction: "outbound",
        message_type: messageType,
        media_url: mediaUrl || null,
        media_caption: mediaCaption || null,
        provider: instance.provider || "wasenderapi",
        provider_message_id: providerMessageId,
        z_api_message_id: providerMessageId, // Compatibilidade
        status: messageSent ? "sent" : "failed",
        is_from_bot: false,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Save error:", saveError);
    }

    // Update conversation
    await supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        current_instance_id: effectiveInstanceId,
      })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({
        success: messageSent,
        message: savedMessage,
        providerMessageId,
        error: !messageSent ? "Falha ao enviar mensagem" : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Send error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Retorna 200 mesmo com erro para não quebrar o front
    });
  }
});
