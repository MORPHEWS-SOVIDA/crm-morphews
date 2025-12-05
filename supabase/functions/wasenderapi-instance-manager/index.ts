import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WASENDERAPI_TOKEN = Deno.env.get("WASENDERAPI_TOKEN");
const WASENDERAPI_BASE_URL = "https://www.wasenderapi.com/api";
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

    console.log("WasenderAPI Instance Manager:", action, instanceId);

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
      case "create_wasender_session": {
        if (!WASENDERAPI_TOKEN) {
          console.error("WASENDERAPI_TOKEN not configured");
          throw new Error("WasenderAPI Token não configurado. Configure nas secrets do projeto.");
        }

        // Check if already has real credentials
        if (instance.wasender_session_id && instance.wasender_api_key) {
          console.log("Instance already has WasenderAPI credentials");
          return new Response(JSON.stringify({ 
            success: true, 
            message: "Session already configured",
            sessionId: instance.wasender_session_id,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Build webhook URL
        const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-multiattendant-webhook`;

        console.log("Creating WasenderAPI session...");
        console.log("Webhook URL:", webhookUrl);

        // Use a placeholder phone number - the real number will be set when user scans QR
        // WasenderAPI requires this field but it's just for identification
        const placeholderPhone = "+5500000000000";

        // Create session on WasenderAPI
        const createResponse = await fetch(`${WASENDERAPI_BASE_URL}/whatsapp-sessions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${WASENDERAPI_TOKEN}`,
          },
          body: JSON.stringify({
            name: `Morphews - ${instance.name}`,
            phone_number: placeholderPhone,
            account_protection: true,
            log_messages: true,
            read_incoming_messages: true,
            webhook_url: webhookUrl,
            webhook_enabled: true,
            webhook_events: ["messages.received", "session.status", "messages.update"],
            auto_reject_calls: true,
          }),
        });

        const responseText = await createResponse.text();
        console.log("WasenderAPI create response status:", createResponse.status);
        console.log("WasenderAPI create response:", responseText);

        if (!createResponse.ok) {
          console.error("WasenderAPI create failed:", createResponse.status, responseText);
          throw new Error(`Falha ao criar sessão no WasenderAPI: ${responseText}`);
        }

        let sessionData;
        try {
          sessionData = JSON.parse(responseText);
        } catch (e) {
          console.error("Failed to parse WasenderAPI response:", e);
          throw new Error("Resposta inválida do WasenderAPI");
        }

        if (!sessionData.success || !sessionData.data) {
          console.error("WasenderAPI response unsuccessful:", sessionData);
          throw new Error("WasenderAPI não retornou dados válidos");
        }

        const session = sessionData.data;
        console.log("WasenderAPI session created:", session.id);

        // Update our database with credentials
        const { error: updateError } = await supabaseAdmin
          .from("whatsapp_instances")
          .update({
            wasender_session_id: String(session.id),
            wasender_api_key: session.api_key,
            status: "pending",
          })
          .eq("id", instanceId);

        if (updateError) {
          console.error("Error updating instance:", updateError);
          throw new Error("Falha ao salvar credenciais");
        }

        console.log("WasenderAPI credentials saved successfully");

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Sessão WasenderAPI criada com sucesso!",
          sessionId: session.id,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "connect_session": {
        // Initialize/connect session to get QR code
        if (!instance.wasender_session_id) {
          throw new Error("Session not created yet");
        }

        console.log("Connecting WasenderAPI session...");

        const connectResponse = await fetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/connect`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${WASENDERAPI_TOKEN}`,
            },
          }
        );

        const connectText = await connectResponse.text();
        console.log("WasenderAPI connect response:", connectResponse.status, connectText);

        if (!connectResponse.ok) {
          throw new Error(`Falha ao conectar sessão: ${connectText}`);
        }

        let connectData;
        try {
          connectData = JSON.parse(connectText);
        } catch (e) {
          throw new Error("Resposta inválida do WasenderAPI");
        }

        // If status is NEED_SCAN, we have QR code
        if (connectData.success && connectData.data?.status === "NEED_SCAN") {
          const qrCode = connectData.data.qrCode;
          
          if (qrCode) {
            await supabaseAdmin
              .from("whatsapp_instances")
              .update({
                qr_code_base64: qrCode,
                status: "pending",
              })
              .eq("id", instanceId);

            return new Response(JSON.stringify({ 
              success: true, 
              qrCode: qrCode,
              status: "NEED_SCAN",
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        return new Response(JSON.stringify({ 
          success: true, 
          status: connectData.data?.status || "unknown",
          message: "Conexão iniciada",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_qr_code": {
        // Get QR code from WasenderAPI
        if (!instance.wasender_session_id) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: "Sessão não criada. Clique em 'Gerar QR Code' para criar.",
            needsAutoCreate: true,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log("Fetching QR code from WasenderAPI...");

        const qrResponse = await fetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/qrcode`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${WASENDERAPI_TOKEN}`,
            },
          }
        );

        const qrText = await qrResponse.text();
        console.log("WasenderAPI QR response:", qrResponse.status);

        if (!qrResponse.ok) {
          // Session might need to be connected first
          if (qrResponse.status === 400 || qrResponse.status === 422) {
            return new Response(JSON.stringify({ 
              success: false, 
              message: "Sessão precisa ser inicializada primeiro",
              needsConnect: true,
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw new Error(`Falha ao obter QR code: ${qrText}`);
        }

        let qrData;
        try {
          qrData = JSON.parse(qrText);
        } catch (e) {
          throw new Error("Resposta inválida do QR code");
        }

        if (qrData.success && qrData.data?.qrCode) {
          await supabaseAdmin
            .from("whatsapp_instances")
            .update({
              qr_code_base64: qrData.data.qrCode,
              status: "pending",
            })
            .eq("id", instanceId);

          return new Response(JSON.stringify({ 
            success: true, 
            qrCode: qrData.data.qrCode,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ 
          success: false, 
          message: "QR code não disponível",
          needsConnect: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check_connection": {
        // Check session status
        if (!instance.wasender_api_key) {
          throw new Error("Session not configured");
        }

        console.log("Checking WasenderAPI connection status...");

        const statusResponse = await fetch(`${WASENDERAPI_BASE_URL}/status`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${instance.wasender_api_key}`,
          },
        });

        const statusText = await statusResponse.text();
        console.log("WasenderAPI status response:", statusResponse.status, statusText);

        let statusData;
        try {
          statusData = JSON.parse(statusText);
        } catch (e) {
          console.error("Failed to parse status:", e);
          return new Response(JSON.stringify({ 
            success: false, 
            connected: false,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const isConnected = statusData.success && statusData.data?.status === "connected";
        const phoneNumber = statusData.data?.phone_number || null;

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
      }

      case "disconnect": {
        // Disconnect session
        if (!instance.wasender_session_id) {
          throw new Error("Session not configured");
        }

        console.log("Disconnecting WasenderAPI session...");

        await fetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/disconnect`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${WASENDERAPI_TOKEN}`,
            },
          }
        );

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
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    console.error("WasenderAPI Instance Manager error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
