import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Z-API configuration (master account)
const ZAPI_MASTER_TOKEN = Deno.env.get('ZAPI_TOKEN');
const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, instanceId } = await req.json();

    console.log("Z-API Instance Manager:", action, instanceId);

    // Get instance from database
    const { data: instance, error: instanceError } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instanceId)
      .single();

    if (instanceError || !instance) {
      throw new Error("Instance not found");
    }

    switch (action) {
      case "create_zapi_instance": {
        // Create a new Z-API instance
        // Note: This requires Z-API reseller/partner API access
        // For now, we'll simulate by generating placeholder credentials
        // In production, this would call Z-API's instance creation endpoint
        
        const zapiInstanceId = `morphews_${instance.id.substring(0, 8)}`;
        const zapiToken = `token_${crypto.randomUUID().replace(/-/g, '').substring(0, 32)}`;
        
        await supabaseAdmin
          .from("whatsapp_instances")
          .update({
            z_api_instance_id: zapiInstanceId,
            z_api_token: zapiToken,
            z_api_client_token: ZAPI_CLIENT_TOKEN,
            status: "pending",
          })
          .eq("id", instanceId);

        console.log("Z-API instance credentials created:", zapiInstanceId);

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Instance credentials created",
          zapiInstanceId,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_qr_code": {
        // Get QR code from Z-API
        if (!instance.z_api_instance_id || !instance.z_api_token) {
          throw new Error("Instance not configured with Z-API");
        }

        const qrUrl = `https://api.z-api.io/instances/${instance.z_api_instance_id}/token/${instance.z_api_token}/qr-code`;
        
        try {
          const response = await fetch(qrUrl, {
            method: 'GET',
            headers: {
              'Client-Token': instance.z_api_client_token || ZAPI_CLIENT_TOKEN || '',
            },
          });

          if (!response.ok) {
            console.error("Z-API QR response:", response.status, await response.text());
            throw new Error("Failed to get QR code from Z-API");
          }

          const qrData = await response.json();
          console.log("QR Code response:", qrData);

          // Store QR code in database
          if (qrData.value) {
            await supabaseAdmin
              .from("whatsapp_instances")
              .update({
                qr_code_base64: qrData.value,
                status: "pending",
              })
              .eq("id", instanceId);
          }

          return new Response(JSON.stringify({ 
            success: true, 
            qrCode: qrData.value,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (zapiError) {
          console.error("Z-API error:", zapiError);
          
          // For demo/testing, return a placeholder message
          return new Response(JSON.stringify({ 
            success: false, 
            message: "Configure Z-API credentials para gerar QR Code",
            needsConfig: true,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      case "check_connection": {
        // Check if WhatsApp is connected
        if (!instance.z_api_instance_id || !instance.z_api_token) {
          throw new Error("Instance not configured with Z-API");
        }

        const statusUrl = `https://api.z-api.io/instances/${instance.z_api_instance_id}/token/${instance.z_api_token}/status`;
        
        try {
          const response = await fetch(statusUrl, {
            method: 'GET',
            headers: {
              'Client-Token': instance.z_api_client_token || ZAPI_CLIENT_TOKEN || '',
            },
          });

          const statusData = await response.json();
          console.log("Connection status:", statusData);

          const isConnected = statusData.connected === true;
          const phoneNumber = statusData.smartphoneConnected ? statusData.wid?.replace('@c.us', '') : null;

          await supabaseAdmin
            .from("whatsapp_instances")
            .update({
              is_connected: isConnected,
              phone_number: phoneNumber,
              status: isConnected ? "active" : "disconnected",
              qr_code_base64: isConnected ? null : instance.qr_code_base64,
            })
            .eq("id", instanceId);

          return new Response(JSON.stringify({ 
            success: true, 
            connected: isConnected,
            phoneNumber,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (zapiError) {
          console.error("Z-API status error:", zapiError);
          return new Response(JSON.stringify({ 
            success: false, 
            connected: false,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      case "disconnect": {
        // Disconnect WhatsApp session
        if (!instance.z_api_instance_id || !instance.z_api_token) {
          throw new Error("Instance not configured with Z-API");
        }

        const disconnectUrl = `https://api.z-api.io/instances/${instance.z_api_instance_id}/token/${instance.z_api_token}/disconnect`;
        
        try {
          await fetch(disconnectUrl, {
            method: 'POST',
            headers: {
              'Client-Token': instance.z_api_client_token || ZAPI_CLIENT_TOKEN || '',
            },
          });

          await supabaseAdmin
            .from("whatsapp_instances")
            .update({
              is_connected: false,
              phone_number: null,
              status: "disconnected",
            })
            .eq("id", instanceId);

          return new Response(JSON.stringify({ 
            success: true, 
            message: "WhatsApp desconectado",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (zapiError) {
          console.error("Z-API disconnect error:", zapiError);
          throw new Error("Failed to disconnect");
        }
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    console.error("Z-API Instance Manager error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
