import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { conversationId, instanceId, content, messageType = "text" } = await req.json();

    console.log("Sending message:", { conversationId, instanceId, content, messageType });

    // Get instance Z-API credentials
    const { data: instance, error: instanceError } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("z_api_instance_id, z_api_token, z_api_client_token")
      .eq("id", instanceId)
      .single();

    if (instanceError || !instance) {
      throw new Error("Instance not found");
    }

    if (!instance.z_api_instance_id || !instance.z_api_token) {
      throw new Error("Instance not configured with Z-API");
    }

    // Get conversation to get phone number
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("whatsapp_conversations")
      .select("phone_number")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      throw new Error("Conversation not found");
    }

    // Send message via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${instance.z_api_instance_id}/token/${instance.z_api_token}/send-text`;
    
    const zapiResponse = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": instance.z_api_client_token || "",
      },
      body: JSON.stringify({
        phone: conversation.phone_number,
        message: content,
      }),
    });

    const zapiResult = await zapiResponse.json();
    console.log("Z-API response:", zapiResult);

    if (!zapiResponse.ok) {
      throw new Error(`Z-API error: ${JSON.stringify(zapiResult)}`);
    }

    // Save message to database
    const { data: message, error: messageError } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        conversation_id: conversationId,
        instance_id: instanceId,
        content: content,
        direction: "outbound",
        message_type: messageType,
        is_from_bot: false,
        z_api_message_id: zapiResult.messageId || null,
        status: "sent",
      })
      .select()
      .single();

    if (messageError) {
      console.error("Error saving message:", messageError);
      // Message was sent but not saved - log but don't fail
    }

    // Update conversation last_message_at
    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: zapiResult.messageId,
        message: message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending message:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
