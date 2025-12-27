import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WASENDERAPI_TOKEN = Deno.env.get("WASENDERAPI_TOKEN");
const WASENDERAPI_BASE_URL = "https://www.wasenderapi.com/api";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

// ===== SAFE RESPONSE HELPERS (NEVER 500) =====
function ok(body: any) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

function fail(code: string, message: string, extra: any = {}) {
  console.log(`[FAIL] ${code}: ${message}`, extra);
  return ok({ success: false, code, message, ...extra });
}

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try { 
    return JSON.parse(text); 
  } catch { 
    return { _raw: text, _parseError: true }; 
  }
}

async function safeFetch(url: string, options: RequestInit): Promise<{ res: Response | null; data: any }> {
  try {
    const res = await fetch(url, options);
    const data = await safeJson(res);
    return { res, data };
  } catch (e) {
    console.log("[safeFetch] Error:", e);
    return { res: null, data: { _fetchError: true, _error: String(e) } };
  }
}

// Normaliza phone para só dígitos
function normalizePhone(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

// Map WasenderAPI status to internal status
const mapStatus = (apiStatus: string, isConnected: boolean): string => {
  if (isConnected || apiStatus === "connected") return "connected";
  if (apiStatus === "NEED_SCAN" || apiStatus === "qr" || apiStatus === "waiting_qr") return "waiting_qr";
  if (apiStatus === "logged_out" || apiStatus === "LOGGED_OUT") return "logged_out";
  if (apiStatus === "error" || apiStatus === "ERROR") return "error";
  return "disconnected";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let action = "";
  let instanceId = "";

  try {
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    action = body.action || "";
    instanceId = body.instanceId || "";
    const { phoneNumber, sessionName } = body;
    
    console.log("WasenderAPI Manager:", action, instanceId);

    if (!instanceId) {
      return fail("MISSING_INSTANCE_ID", "instanceId é obrigatório");
    }

    // Get instance from database
    const { data: instance, error: instanceError } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instanceId)
      .single();

    if (instanceError || !instance) {
      return fail("INSTANCE_NOT_FOUND", "Instância não encontrada", { instanceId });
    }

    switch (action) {
      // ==================== STATUS ====================
      case "status": {
        if (!instance.wasender_api_key) {
          await supabaseAdmin.from("whatsapp_instances").update({
            is_connected: false,
            status: "pending",
          }).eq("id", instanceId);

          return ok({ 
            success: true, 
            status: "waiting_qr",
            isConnected: false,
            needsQr: true,
            diagnostics: "no_api_key",
          });
        }

        console.log("Checking status...");
        const { res: statusResponse, data: statusData } = await safeFetch(
          `${WASENDERAPI_BASE_URL}/status`,
          { method: "GET", headers: { "Authorization": `Bearer ${instance.wasender_api_key}` } }
        );

        if (!statusResponse) {
          // API failed but we don't throw - return graceful response
          return ok({ 
            success: true, 
            status: "disconnected", 
            isConnected: false, 
            needsQr: true, 
            diagnostics: "fetch_failed" 
          });
        }

        const rawStatus = (statusData.status ?? "").toString().toLowerCase();
        const isConnected = rawStatus === "connected" || rawStatus === "open" || rawStatus === "ready";
        const internalStatus = mapStatus(rawStatus, isConnected);

        // SEMPRE buscar phone number atualizado quando conectado
        let phoneNum = null;
        
        // Tentar extrair do status response primeiro
        if (statusData.phone) {
          phoneNum = normalizePhone(statusData.phone);
          console.log("Extracted phone from status:", phoneNum);
        } else if (statusData.phoneNumber) {
          phoneNum = normalizePhone(statusData.phoneNumber);
          console.log("Extracted phoneNumber from status:", phoneNum);
        } else if (statusData.me?.user) {
          phoneNum = normalizePhone(statusData.me.user);
          console.log("Extracted phone from me.user:", phoneNum);
        } else if (statusData.jid) {
          const jidPhone = (statusData.jid || "").replace("@s.whatsapp.net", "").replace("@c.us", "");
          if (jidPhone) {
            phoneNum = normalizePhone(jidPhone);
            console.log("Extracted phone from jid:", phoneNum);
          }
        }
        
        // Se não obteve do status e está conectado, tentar da sessão
        if (!phoneNum && isConnected && instance.wasender_session_id && WASENDERAPI_TOKEN) {
          console.log("Fetching session details for phone number...");
          const { data: details } = await safeFetch(
            `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}`,
            { headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
          );
          console.log("Session details response:", JSON.stringify(details).substring(0, 500));
          
          if (details?.success && details.data?.phone_number) {
            phoneNum = normalizePhone(details.data.phone_number);
            console.log("Extracted phone from session details:", phoneNum);
          } else if (details?.data?.phone) {
            phoneNum = normalizePhone(details.data.phone);
            console.log("Extracted phone (alt) from session details:", phoneNum);
          }
        }
        
        // Fallback para o phone_number atual se não encontrou novo
        const finalPhoneNum = phoneNum || instance.phone_number;

        // Update database - SEMPRE atualizar phone_number se diferente
        const updateData: any = {
          is_connected: isConnected,
          status: isConnected ? "active" : (internalStatus === "waiting_qr" ? "pending" : "disconnected"),
          qr_code_base64: isConnected ? null : instance.qr_code_base64,
        };
        
        // Se detectou um número diferente, atualizar
        if (phoneNum && phoneNum !== instance.phone_number) {
          updateData.phone_number = phoneNum;
          console.log("📱 Updating phone_number from", instance.phone_number, "to", phoneNum);
        } else if (finalPhoneNum) {
          updateData.phone_number = finalPhoneNum;
        }
        
        await supabaseAdmin.from("whatsapp_instances").update(updateData).eq("id", instanceId);

        return ok({ 
          success: true, 
          status: internalStatus,
          isConnected,
          phoneNumber: updateData.phone_number || finalPhoneNum,
          needsQr: !isConnected,
        });
      }

      // ==================== CONNECT ====================
      case "connect": {
        if (!instance.wasender_session_id) {
          return ok({ 
            success: false, 
            code: "NO_SESSION",
            message: "Sessão não criada ainda",
            needsQr: true,
          });
        }

        // First check if already connected
        if (instance.wasender_api_key) {
          const { data: st } = await safeFetch(
            `${WASENDERAPI_BASE_URL}/status`,
            { headers: { "Authorization": `Bearer ${instance.wasender_api_key}` } }
          );
          if (st?.status === "connected") {
            // Clear QR and update status
            await supabaseAdmin.from("whatsapp_instances").update({
              is_connected: true,
              status: "active",
              qr_code_base64: null,
            }).eq("id", instanceId);

            return ok({ 
              success: true, 
              isConnected: true,
              status: "connected",
            });
          }
        }

        // Connect session
        console.log("Connecting session...");
        const { data: connectData } = await safeFetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/connect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );
        
        if (connectData?.success && connectData.data?.qrCode) {
          await supabaseAdmin.from("whatsapp_instances").update({
            qr_code_base64: connectData.data.qrCode,
            status: "pending",
            is_connected: false,
          }).eq("id", instanceId);

          return ok({ 
            success: true, 
            qrCode: connectData.data.qrCode,
            status: "waiting_qr",
          });
        }

        // Check if maybe it connected during the request
        if (connectData?.data?.status === "connected") {
          await supabaseAdmin.from("whatsapp_instances").update({
            is_connected: true,
            status: "active",
            qr_code_base64: null,
          }).eq("id", instanceId);

          return ok({ 
            success: true, 
            isConnected: true,
            status: "connected",
          });
        }

        return ok({ 
          success: true, 
          status: connectData?.data?.status || "unknown",
          needsQr: true,
          diagnostics: "no_qr_returned",
        });
      }

      // ==================== REFRESH_QR ====================
      case "refresh_qr": {
        if (!instance.wasender_session_id) {
          return fail("NO_SESSION", "Sessão não configurada");
        }

        console.log("Refreshing QR...");
        
        // Try connect endpoint first
        const { data: connectData } = await safeFetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/connect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        let qrCode = null;
        if (connectData?.success && connectData.data?.qrCode) {
          qrCode = connectData.data.qrCode;
        }

        // Fallback to qrcode endpoint
        if (!qrCode) {
          const { data: qrData } = await safeFetch(
            `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/qrcode`,
            { headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
          );
          if (qrData?.success && qrData.data?.qrCode) {
            qrCode = qrData.data.qrCode;
          }
        }

        if (qrCode) {
          await supabaseAdmin.from("whatsapp_instances").update({
            qr_code_base64: qrCode,
            status: "pending",
            is_connected: false,
          }).eq("id", instanceId);
        }

        return ok({ 
          success: !!qrCode, 
          qrCode,
          status: "waiting_qr",
        });
      }

      // ==================== DISCONNECT ====================
      case "disconnect": {
        if (!instance.wasender_session_id) {
          return ok({ success: true, status: "disconnected" });
        }

        console.log("Disconnecting...");
        await safeFetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/disconnect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        await supabaseAdmin.from("whatsapp_instances").update({
          is_connected: false,
          status: "disconnected",
          qr_code_base64: null,
        }).eq("id", instanceId);

        return ok({ success: true, status: "disconnected" });
      }

      // ==================== RESTART ====================
      case "restart": {
        if (!instance.wasender_session_id) {
          return fail("NO_SESSION", "Sessão não configurada");
        }

        console.log("Restarting session...");
        
        // Disconnect first
        await safeFetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/disconnect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        await new Promise(r => setTimeout(r, 1000));

        // Reconnect
        const { data: connectData } = await safeFetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/connect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        let qrCode = null;
        if (connectData?.success && connectData.data?.qrCode) {
          qrCode = connectData.data.qrCode;
          await supabaseAdmin.from("whatsapp_instances").update({
            qr_code_base64: qrCode,
            status: "pending",
            is_connected: false,
          }).eq("id", instanceId);
        }

        return ok({ 
          success: true, 
          qrCode,
          status: qrCode ? "waiting_qr" : "disconnected",
        });
      }

      // ==================== CREATE_WASENDER_SESSION ====================
      case "create_wasender_session": {
        if (!WASENDERAPI_TOKEN) {
          return fail("NO_TOKEN", "WasenderAPI Token não configurado");
        }

        if (instance.wasender_session_id && instance.wasender_api_key) {
          return ok({ 
            success: true, 
            message: "Sessão já configurada",
            sessionId: instance.wasender_session_id,
          });
        }

        if (!phoneNumber) {
          return fail("NO_PHONE", "Número de telefone é obrigatório");
        }

        const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-multiattendant-webhook`;
        const finalSessionName = sessionName || instance.name || "Sessão WhatsApp";

        console.log("Creating session:", finalSessionName);

        const { res: createRes, data: sessionData } = await safeFetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions`,
          {
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
          }
        );

        if (!createRes || !sessionData.success) {
          return fail("CREATE_FAILED", sessionData.message || "Falha ao criar sessão", { 
            apiResponse: sessionData 
          });
        }

        const session = sessionData.data;
        await supabaseAdmin.from("whatsapp_instances").update({
          wasender_session_id: String(session.id),
          wasender_api_key: session.api_key,
          status: "pending",
          phone_number: phoneNumber.replace(/\D/g, ""),
        }).eq("id", instanceId);

        // Wait a bit then get QR code
        await new Promise(r => setTimeout(r, 1500));
        
        const { data: connectData } = await safeFetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${session.id}/connect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        let qrCode = null;
        if (connectData?.success && connectData.data?.qrCode) {
          qrCode = connectData.data.qrCode;
          await supabaseAdmin.from("whatsapp_instances").update({ 
            qr_code_base64: qrCode 
          }).eq("id", instanceId);
        }

        return ok({ 
          success: true, 
          sessionId: session.id,
          qrCode,
        });
      }

      // ==================== CHANGE_PHONE_NUMBER ====================
      case "change_phone_number": {
        if (!instance.wasender_session_id) {
          return fail("NO_SESSION", "Sessão não configurada");
        }
        if (!phoneNumber) {
          return fail("NO_PHONE", "Novo número é obrigatório");
        }

        console.log("Changing phone to:", phoneNumber);

        // Disconnect first
        await safeFetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/disconnect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        // Update phone in WasenderAPI
        await safeFetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${WASENDERAPI_TOKEN}` },
            body: JSON.stringify({ 
              phone_number: phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}` 
            }),
          }
        );

        await supabaseAdmin.from("whatsapp_instances").update({
          is_connected: false,
          phone_number: phoneNumber.replace(/\D/g, ""),
          status: "pending",
          qr_code_base64: null,
        }).eq("id", instanceId);

        await new Promise(r => setTimeout(r, 1000));

        // Reconnect to get new QR
        const { data: connectData } = await safeFetch(
          `${WASENDERAPI_BASE_URL}/whatsapp-sessions/${instance.wasender_session_id}/connect`,
          { method: "POST", headers: { "Authorization": `Bearer ${WASENDERAPI_TOKEN}` } }
        );

        let qrCode = null;
        if (connectData?.success && connectData.data?.qrCode) {
          qrCode = connectData.data.qrCode;
          await supabaseAdmin.from("whatsapp_instances").update({ 
            qr_code_base64: qrCode 
          }).eq("id", instanceId);
        }

        return ok({ success: true, qrCode, status: "waiting_qr" });
      }

      default:
        return fail("UNKNOWN_ACTION", `Ação desconhecida: ${action}`);
    }
  } catch (error: any) {
    // Even on unexpected errors, return 200 with error info
    console.error("Unexpected error:", error);
    return ok({ 
      success: false, 
      code: "UNEXPECTED_ERROR", 
      message: error.message || "Erro inesperado",
      action,
      instanceId,
    });
  }
});