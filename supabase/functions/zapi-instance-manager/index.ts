import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Z-API configuration (master account)
const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      SUPABASE_URL,
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
      console.error("Instance not found:", instanceId, instanceError);
      throw new Error("Instance not found");
    }

    switch (action) {
      case "create_zapi_instance": {
        // Create a new Z-API instance using their API
        if (!ZAPI_CLIENT_TOKEN) {
          console.error("ZAPI_CLIENT_TOKEN not configured");
          throw new Error("Z-API Client Token não configurado. Configure nas secrets do projeto.");
        }

        // Check if already has real credentials
        if (instance.z_api_instance_id && 
            !instance.z_api_instance_id.startsWith("morphews_") &&
            instance.z_api_token &&
            !instance.z_api_token.startsWith("token_")) {
          console.log("Instance already has real Z-API credentials");
          return new Response(JSON.stringify({ 
            success: true, 
            message: "Instance already configured",
            zapiInstanceId: instance.z_api_instance_id,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Build webhook URLs using Supabase function URL
        const webhookBaseUrl = `${SUPABASE_URL}/functions/v1/whatsapp-multiattendant-webhook`;

        console.log("Creating Z-API instance via API...");
        console.log("Webhook URL:", webhookBaseUrl);

        // Z-API uses Client-Token header, not Authorization Bearer
        const zapiResponse = await fetch("https://api.z-api.io/instances/integrator/on-demand", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": ZAPI_CLIENT_TOKEN,
          },
          body: JSON.stringify({
            name: `Morphews - ${instance.name}`,
            deliveryCallbackUrl: webhookBaseUrl,
            receivedCallbackUrl: webhookBaseUrl,
            disconnectedCallbackUrl: webhookBaseUrl,
            connectedCallbackUrl: webhookBaseUrl,
            messageStatusCallbackUrl: webhookBaseUrl,
            autoReadMessage: true,
            callRejectAuto: true,
            callRejectMessage: "Desculpe, não atendemos chamadas. Por favor, envie uma mensagem de texto.",
            isDevice: false,
            businessDevice: false,
          }),
        });

        const zapiResponseText = await zapiResponse.text();
        console.log("Z-API create response status:", zapiResponse.status);
        console.log("Z-API create response:", zapiResponseText);

        if (!zapiResponse.ok) {
          console.error("Z-API create failed:", zapiResponse.status, zapiResponseText);
          throw new Error(`Falha ao criar instância no Z-API: ${zapiResponseText}`);
        }

        let zapiData;
        try {
          zapiData = JSON.parse(zapiResponseText);
        } catch (e) {
          console.error("Failed to parse Z-API response:", e);
          throw new Error("Resposta inválida do Z-API");
        }

        if (!zapiData.id || !zapiData.token) {
          console.error("Z-API response missing id or token:", zapiData);
          throw new Error("Z-API não retornou credenciais válidas");
        }

        console.log("Z-API instance created:", zapiData.id);

        // Update our database with real credentials
        const { error: updateError } = await supabaseAdmin
          .from("whatsapp_instances")
          .update({
            z_api_instance_id: zapiData.id,
            z_api_token: zapiData.token,
            z_api_client_token: ZAPI_CLIENT_TOKEN,
            status: "pending",
          })
          .eq("id", instanceId);

        if (updateError) {
          console.error("Error updating instance:", updateError);
          throw new Error("Falha ao salvar credenciais");
        }

        console.log("Instance credentials saved successfully");

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Instância Z-API criada com sucesso!",
          zapiInstanceId: zapiData.id,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_qr_code": {
        // Get QR code from Z-API
        if (!instance.z_api_instance_id || !instance.z_api_token) {
          throw new Error("Instance not configured with Z-API");
        }

        // Check if credentials are placeholder/fake
        if (instance.z_api_instance_id.startsWith("morphews_") || 
            instance.z_api_token.startsWith("token_")) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: "Credenciais Z-API não configuradas. Clique em 'Gerar QR Code' novamente para criar automaticamente.",
            needsConfig: true,
            needsAutoCreate: true,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const qrUrl = `https://api.z-api.io/instances/${instance.z_api_instance_id}/token/${instance.z_api_token}/qr-code`;
        
        console.log("Fetching QR code from:", qrUrl);

        try {
          const headers: Record<string, string> = {};
          if (instance.z_api_client_token || ZAPI_CLIENT_TOKEN) {
            headers['Client-Token'] = instance.z_api_client_token || ZAPI_CLIENT_TOKEN || '';
          }

          const response = await fetch(qrUrl, {
            method: 'GET',
            headers,
          });

          const responseText = await response.text();
          console.log("Z-API QR response status:", response.status);

          if (!response.ok) {
            console.error("Z-API QR response error:", response.status, responseText);
            
            // Check if instance doesn't exist or is disconnected
            if (responseText.includes("Instance not found") || response.status === 400) {
              return new Response(JSON.stringify({ 
                success: false, 
                message: "Instância não encontrada no Z-API. Pode ter expirado. Tente recriar.",
                needsConfig: true,
                needsAutoCreate: true,
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            
            throw new Error("Failed to get QR code from Z-API");
          }

          let qrData;
          try {
            qrData = JSON.parse(responseText);
          } catch (e) {
            console.error("Failed to parse QR response:", responseText);
            throw new Error("Invalid QR code response");
          }

          console.log("QR Code response received, has value:", !!qrData.value);

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
          
          return new Response(JSON.stringify({ 
            success: false, 
            message: "Erro ao obter QR Code. Verifique as credenciais Z-API.",
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
        
        console.log("Checking connection status...");

        try {
          const headers: Record<string, string> = {};
          if (instance.z_api_client_token || ZAPI_CLIENT_TOKEN) {
            headers['Client-Token'] = instance.z_api_client_token || ZAPI_CLIENT_TOKEN || '';
          }

          const response = await fetch(statusUrl, {
            method: 'GET',
            headers,
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
        
        console.log("Disconnecting WhatsApp...");

        try {
          const headers: Record<string, string> = {};
          if (instance.z_api_client_token || ZAPI_CLIENT_TOKEN) {
            headers['Client-Token'] = instance.z_api_client_token || ZAPI_CLIENT_TOKEN || '';
          }

          await fetch(disconnectUrl, {
            method: 'POST',
            headers,
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
