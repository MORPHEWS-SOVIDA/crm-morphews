import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WASENDERAPI_TOKEN = Deno.env.get("WASENDERAPI_TOKEN");
const WASENDERAPI_BASE_URL = "https://www.wasenderapi.com/api";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

// Map WasenderAPI status to internal status
const mapStatus = (apiStatus: string, isConnected: boolean): string => {
  if (isConnected || apiStatus === "connected") return "connected";
  if (apiStatus === "NEED_SCAN" || apiStatus === "qr") return "waiting_qr";
  if (apiStatus === "logged_out" || apiStatus === "LOGGED_OUT") return "logged_out";
  if (apiStatus === "error" || apiStatus === "ERROR") return "error";
  return "disconnected";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, instanceId, phoneNumber, sessionName } = await req.json();
    console.log("WasenderAPI Manager:", action, instanceId);

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
      // ==================== STATUS ====================
      case "status": {
        if (!instance.wasender_api_key) {
          return new Response(JSON.stringify({ 
            success: true, 
            status: "disconnected",
            isConnected: false,
            needsQr: true,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        console.log("Checking status...");
        const statusResponse = await fetch(`${WASENDERAPI_BASE_URL}/status`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${instance.wasender_api_key}` },
        });

        const statusText = await statusResponse.text();
        let statusData;
        try { statusData = JSON.parse(statusText); } catch (e) { statusData = {}; }

        const isConnected = statusData.status === "connected";
        const internalStatus = mapStatus(statusData.status || "", isConnected);

        // Fetch phone number if connected
        let phoneNum = instance.phone_number;
        if (isConnected && instance.wasender_session_id && WASENDERAPI_TOKEN) {
          try {
            const detailsRes = await fetch(
              `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}`,
              { headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
            );
            if (detailsRes.ok) {
              const details = await detailsRes.json();
              if (details.success && details.data?.phone_number) {
                phoneNum = details.data.phone_number.replace(/\D/g, "");
              }
            }
          } catch (e) { console.log("Could not fetch phone number"); }
        }

        // Update database
        await supabaseAdmin.from("whatsapp_instances").update({
          is_connected: isConnected,
          phone_number: phoneNum,
          status: isConnected ? "active" : internalStatus === "waiting_qr" ? "pending" : "disconnected",
          qr_code_base64: isConnected ? null : instance.qr_code_base64,
        }).eq("id", instanceId);

        return new Response(JSON.stringify({ 
          success: true, 
          status: internalStatus,
          isConnected,
          phoneNumber: phoneNum,
          needsQr: !isConnected,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ==================== CONNECT ====================
      case "connect": {
        if (!instance.wasender_session_id) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: "Session not created yet",
            needsQr: true,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // First check if already connected
        if (instance.wasender_api_key) {
          const statusRes = await fetch(`${WASENDERAPI_BASE_URL}/status`, {
            headers: { "Authorization": `Bearer ${instance.wasender_api_key}` },
          });
          if (statusRes.ok) {
            const st = await statusRes.json();
            if (st.status === "connected") {
              return new Response(JSON.stringify({ 
                success: true, 
                isConnected: true,
                status: "connected",
              }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          }
        }

        // Connect session
        console.log("Connecting session...");
        const connectRes = await fetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/connect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        const connectData = await connectRes.json().catch(() => ({}));
        
        if (connectData.success && connectData.data?.qrCode) {
          await supabaseAdmin.from("whatsapp_instances").update({
            qr_code_base64: connectData.data.qrCode,
            status: "pending",
          }).eq("id", instanceId);

          return new Response(JSON.stringify({ 
            success: true, 
            qrCode: connectData.data.qrCode,
            status: "waiting_qr",
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          status: connectData.data?.status || "unknown",
          needsQr: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ==================== REFRESH_QR ====================
      case "refresh_qr": {
        if (!instance.wasender_session_id) {
          return new Response(JSON.stringify({ success: false, message: "No session" }), 
            { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        console.log("Refreshing QR...");
        
        // Try connect endpoint first
        const connectRes = await fetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/connect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        let qrCode = null;
        if (connectRes.ok) {
          const data = await connectRes.json().catch(() => ({}));
          if (data.success && data.data?.qrCode) {
            qrCode = data.data.qrCode;
          }
        }

        // Fallback to qrcode endpoint
        if (!qrCode) {
          const qrRes = await fetch(
            `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/qrcode`,
            { headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
          );
          if (qrRes.ok) {
            const qrData = await qrRes.json().catch(() => ({}));
            if (qrData.success && qrData.data?.qrCode) {
              qrCode = qrData.data.qrCode;
            }
          }
        }

        if (qrCode) {
          await supabaseAdmin.from("whatsapp_instances").update({
            qr_code_base64: qrCode,
            status: "pending",
          }).eq("id", instanceId);
        }

        return new Response(JSON.stringify({ 
          success: !!qrCode, 
          qrCode,
          status: "waiting_qr",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ==================== DISCONNECT ====================
      case "disconnect": {
        if (!instance.wasender_session_id) {
          return new Response(JSON.stringify({ success: true }), 
            { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        console.log("Disconnecting...");
        await fetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/disconnect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        await supabaseAdmin.from("whatsapp_instances").update({
          is_connected: false,
          status: "disconnected",
          qr_code_base64: null,
        }).eq("id", instanceId);

        return new Response(JSON.stringify({ success: true, status: "disconnected" }), 
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ==================== RESTART ====================
      case "restart": {
        if (!instance.wasender_session_id) {
          return new Response(JSON.stringify({ success: false, message: "No session" }), 
            { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        console.log("Restarting session...");
        
        // Disconnect first
        await fetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/disconnect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        await new Promise(r => setTimeout(r, 1000));

        // Reconnect
        const connectRes = await fetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/connect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        let qrCode = null;
        if (connectRes.ok) {
          const data = await connectRes.json().catch(() => ({}));
          if (data.success && data.data?.qrCode) {
            qrCode = data.data.qrCode;
            await supabaseAdmin.from("whatsapp_instances").update({
              qr_code_base64: qrCode,
              status: "pending",
              is_connected: false,
            }).eq("id", instanceId);
          }
        }

        return new Response(JSON.stringify({ 
          success: true, 
          qrCode,
          status: qrCode ? "waiting_qr" : "disconnected",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ==================== CREATE_WASENDER_SESSION ====================
      case "create_wasender_session": {
        if (!WASENDERAPI_TOKEN) {
          throw new Error("WasenderAPI Token não configurado");
        }

        if (instance.wasender_session_id && instance.wasender_api_key) {
          return new Response(JSON.stringify({ 
            success: true, 
            message: "Session already configured",
            sessionId: instance.wasender_session_id,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (!phoneNumber) {
          throw new Error("Número de telefone é obrigatório");
        }

        const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-multiattendant-webhook`;
        const finalSessionName = sessionName || instance.name || "Sessão WhatsApp";

        console.log("Creating session:", finalSessionName);

        const createRes = await fetch(`${WASENDERAPI_BASE_URL}/whatsapp-sessions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${WASENDERAPI_TOKEN}`,
          },
          body: JSON.stringify({
            name: finalSessionName,
            phone_number: phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`,
            account_protection: true,
            log_messages: true,
            read_incoming_messages: true,
            webhook_url: webhookUrl,
            webhook_enabled: true,
            webhook_events: ["messages.received", "messages.upsert", "session.status", "messages.update"],
            auto_reject_calls: true,
          }),
        });

        const sessionData = await createRes.json();
        if (!createRes.ok || !sessionData.success) {
          throw new Error(sessionData.message || "Falha ao criar sessão");
        }

        const session = sessionData.data;
        await supabaseAdmin.from("whatsapp_instances").update({
          wasender_session_id: String(session.id),
          wasender_api_key: session.api_key,
          status: "pending",
        }).eq("id", instanceId);

        // Get QR code
        await new Promise(r => setTimeout(r, 1000));
        const connectRes = await fetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${session.id}/connect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        let qrCode = null;
        if (connectRes.ok) {
          const data = await connectRes.json().catch(() => ({}));
          if (data.success && data.data?.qrCode) {
            qrCode = data.data.qrCode;
            await supabaseAdmin.from("whatsapp_instances").update({ qr_code_base64: qrCode }).eq("id", instanceId);
          }
        }

        return new Response(JSON.stringify({ 
          success: true, 
          sessionId: session.id,
          qrCode,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ==================== CHANGE_PHONE_NUMBER ====================
      case "change_phone_number": {
        if (!instance.wasender_session_id) throw new Error("No session");
        if (!phoneNumber) throw new Error("Novo número obrigatório");

        console.log("Changing phone to:", phoneNumber);

        // Disconnect
        await fetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/disconnect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        // Update phone
        await fetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${WASENDERAPI_TOKEN}` },
            body: JSON.stringify({ phone_number: phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}` }),
          }
        );

        await supabaseAdmin.from("whatsapp_instances").update({
          is_connected: false,
          phone_number: null,
          status: "pending",
        }).eq("id", instanceId);

        await new Promise(r => setTimeout(r, 1000));

        // Reconnect
        const connectRes = await fetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/connect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        let qrCode = null;
        if (connectRes.ok) {
          const data = await connectRes.json().catch(() => ({}));
          if (data.success && data.data?.qrCode) {
            qrCode = data.data.qrCode;
            await supabaseAdmin.from("whatsapp_instances").update({ qr_code_base64: qrCode }).eq("id", instanceId);
          }
        }

        return new Response(JSON.stringify({ success: true, qrCode }), 
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
