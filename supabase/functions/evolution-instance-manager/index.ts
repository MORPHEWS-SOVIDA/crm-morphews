// Evolution instance manager - v2
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const PUBLIC_APP_URL = Deno.env.get("PUBLIC_APP_URL") ?? "https://crm.morphews.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Gera um nome de instância único baseado no org + nome
function generateInstanceName(orgId: string, name: string): string {
  const cleanName = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 20);
  const shortOrg = orgId.substring(0, 8);
  const random = Math.random().toString(36).substring(2, 6);
  return `${cleanName}-${shortOrg}-${random}`;
}

// Webhook URL base - será configurado no Evolution para apontar para nossa function
function getWebhookUrl(instanceName: string): string {
  // Usamos a função evolution-webhook que vai receber eventos de todas as instâncias
  return `${SUPABASE_URL}/functions/v1/evolution-webhook`;
}

function extractPhoneFromOwnerValue(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;
  // Pode vir como "5511999999999@s.whatsapp.net" ou só "5511999999999"
  const beforeAt = value.split("@")[0];
  const digits = beforeAt.replace(/\D/g, "");
  return digits ? digits : null;
}

async function fetchOwnerPhoneFromEvolution(instanceName: string): Promise<string | null> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return null;

  try {
    const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      method: "GET",
      headers: { apikey: EVOLUTION_API_KEY },
    });

    if (!res.ok) {
      console.warn("fetchInstances failed:", res.status);
      return null;
    }

    const list = await res.json().catch(() => null);
    const items: any[] = Array.isArray(list) ? list : [];

    const found = items.find((it) => it?.instance?.instanceName === instanceName);
    const owner = found?.instance?.owner ?? found?.instance?.ownerJid;

    return extractPhoneFromOwnerValue(owner);
  } catch (e) {
    console.warn("Could not fetch owner phone from Evolution:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autorizado");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Usuário não autenticado");
    }

    // Buscar organization do usuário
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      throw new Error("Usuário não pertence a nenhuma organização");
    }

    const organizationId = membership.organization_id;
    const body = await req.json();
    const { action, instanceId, name, evolution_instance_id, evolution_api_token, phone_number, manual_instance_number, manual_device_label, display_name_for_team, settings } = body;

    console.log("Evolution Instance Manager:", { action, instanceId, name, organizationId });

    // =====================
    // CREATE INSTANCE
    // =====================
    if (action === "create") {
      if (!name) {
        throw new Error("Nome da instância é obrigatório");
      }

      const evolutionInstanceName = generateInstanceName(organizationId, name);
      const webhookUrl = getWebhookUrl(evolutionInstanceName);

      // Usar settings passados ou valores default
      const instanceSettings = {
        reject_call: settings?.reject_call ?? true,
        msg_call: settings?.msg_call ?? "Não posso atender agora, me envie uma mensagem.",
        groups_ignore: settings?.groups_ignore ?? false,
        always_online: settings?.always_online ?? false,
        read_messages: settings?.read_messages ?? true,
        read_status: settings?.read_status ?? false,
        sync_full_history: settings?.sync_full_history ?? false,
      };

      console.log("Creating Evolution instance:", { evolutionInstanceName, webhookUrl, settings: instanceSettings });

      // 1. Criar instância no Evolution API
      const createResponse = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          instanceName: evolutionInstanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          rejectCall: instanceSettings.reject_call,
          msgCall: instanceSettings.msg_call,
          groupsIgnore: instanceSettings.groups_ignore,
          alwaysOnline: instanceSettings.always_online,
          readMessages: instanceSettings.read_messages,
          readStatus: instanceSettings.read_status,
          syncFullHistory: instanceSettings.sync_full_history,
          webhook: {
            url: webhookUrl,
            byEvents: false,
            base64: true,
            headers: {
              "Content-Type": "application/json",
            },
            events: [
              "MESSAGES_UPSERT",
              "CONNECTION_UPDATE",
              "QRCODE_UPDATED",
              "GROUPS_UPSERT", // Evento de grupos
            ],
          },
        }),
      });

      const createResult = await createResponse.json().catch(() => ({}));
      console.log("Evolution create response:", { status: createResponse.status, result: createResult });

      if (!createResponse.ok) {
        throw new Error(createResult?.message || createResult?.error || `Erro ao criar instância: ${createResponse.status}`);
      }

      // Algumas versões do Evolution ignoram settings no /instance/create.
      // Garantimos explicitamente aplicando os settings via API.
      try {
        const settingsResponse = await fetch(`${EVOLUTION_API_URL}/settings/set/${evolutionInstanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            rejectCall: instanceSettings.reject_call,
            msgCall: instanceSettings.msg_call,
            groupsIgnore: instanceSettings.groups_ignore,
            alwaysOnline: instanceSettings.always_online,
            readMessages: instanceSettings.read_messages,
            readStatus: instanceSettings.read_status,
            syncFullHistory: instanceSettings.sync_full_history,
          }),
        });

        const settingsResult = await settingsResponse.json().catch(() => ({}));
        console.log("Evolution settings result:", { status: settingsResponse.status, result: settingsResult });
      } catch (e) {
        console.warn("Could not set Evolution settings:", e);
      }

      // Garantir webhook/events (inclui GROUPS_UPSERT) na instância recém-criada
      try {
        const webhookSetResponse = await fetch(`${EVOLUTION_API_URL}/webhook/set/${evolutionInstanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            url: webhookUrl,
            byEvents: false,
            base64: true,
            headers: {
              "Content-Type": "application/json",
            },
            events: [
              "MESSAGES_UPSERT",
              "CONNECTION_UPDATE",
              "QRCODE_UPDATED",
              "GROUPS_UPSERT",
            ],
          }),
        });

        const webhookSetResult = await webhookSetResponse.json().catch(() => ({}));
        console.log("Evolution webhook set result:", { status: webhookSetResponse.status, result: webhookSetResult });
      } catch (e) {
        console.warn("Could not set Evolution webhook:", e);
      }
      // 2. Salvar no banco de dados
      const { data: instance, error: insertError } = await supabase
        .from("whatsapp_instances")
        .insert({
          organization_id: organizationId,
          name: name,
          provider: "evolution",
          evolution_instance_id: evolutionInstanceName,
          evolution_api_token: createResult?.hash || createResult?.token || null,
          evolution_webhook_configured: true,
          status: "pending",
          is_connected: false,
          monthly_price_cents: 0,
          payment_source: "admin_grant", // Instâncias Evolution são gratuitas (concedidas pelo admin)
          manual_instance_number: manual_instance_number || null,
          manual_device_label: manual_device_label || null,
          display_name_for_team: display_name_for_team || null,
          evolution_settings: instanceSettings, // Salvar settings no banco
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error saving instance:", insertError);
        // Tentar deletar a instância criada no Evolution
        await fetch(`${EVOLUTION_API_URL}/instance/delete/${evolutionInstanceName}`, {
          method: "DELETE",
          headers: { "apikey": EVOLUTION_API_KEY },
        });
        throw new Error("Erro ao salvar instância no banco");
      }

      // 3. Buscar QR Code (NÃO salvar no banco - apenas retornar)
      const qrResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${evolutionInstanceName}`, {
        method: "GET",
        headers: { "apikey": EVOLUTION_API_KEY },
      });

      const qrResult = await qrResponse.json().catch(() => ({}));
      console.log("QR Code response:", { status: qrResponse.status, hasBase64: !!qrResult?.base64 });

      // Retornar QR code diretamente na resposta (não salva no banco para evitar "Data too long")
      return new Response(JSON.stringify({
        success: true,
        instance: {
          ...instance,
          qr_code_base64: null, // Não incluir no objeto da instância
        },
        qr_code_base64: qrResult?.base64 || null, // Retornar separado
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // GET QR CODE
    // =====================
    if (action === "get_qr") {
      if (!instanceId) {
        throw new Error("instanceId é obrigatório");
      }

      // Buscar instância no banco
      const { data: instance, error: fetchError } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instanceId)
        .eq("organization_id", organizationId)
        .single();

      if (fetchError || !instance) {
        throw new Error("Instância não encontrada");
      }

      if (!instance.evolution_instance_id) {
        throw new Error("Instância não está configurada no Evolution");
      }

      // Helper para buscar QR
      const fetchQR = async () => {
        const resp = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instance.evolution_instance_id}`, {
          method: "GET",
          headers: { "apikey": EVOLUTION_API_KEY },
        });
        const result = await resp.json().catch(() => ({}));
        console.log("QR Code response:", { status: resp.status, hasBase64: !!result?.base64, hasPairingCode: !!result?.pairingCode, keys: Object.keys(result || {}) });
        return result;
      };

      // 1ª tentativa
      let qrResult = await fetchQR();

      // Se não retornou QR, tentar reiniciar e buscar novamente
      if (!qrResult?.base64 && !qrResult?.pairingCode) {
        console.log("No QR returned, attempting recovery...");
        
        // Tentar logout primeiro para forçar estado de desconectado
        try {
          const logoutResp = await fetch(`${EVOLUTION_API_URL}/instance/logout/${instance.evolution_instance_id}`, {
            method: "DELETE",
            headers: { "apikey": EVOLUTION_API_KEY },
          });
          console.log("Logout response:", logoutResp.status);
        } catch (e) {
          console.warn("Logout failed:", e);
        }

        await new Promise(resolve => setTimeout(resolve, 3000));

        // 2ª tentativa
        qrResult = await fetchQR();

        // Se ainda não retornou, tentar restart com POST (compatibilidade)
        if (!qrResult?.base64 && !qrResult?.pairingCode) {
          for (const method of ["POST", "PUT"]) {
            try {
              const restartResp = await fetch(`${EVOLUTION_API_URL}/instance/restart/${instance.evolution_instance_id}`, {
                method,
                headers: { "apikey": EVOLUTION_API_KEY },
              });
              console.log(`Restart (${method}) response:`, restartResp.status);
              if (restartResp.ok) break;
            } catch (_) {}
          }

          await new Promise(resolve => setTimeout(resolve, 3000));

          // 3ª tentativa final
          qrResult = await fetchQR();
        }
      }

      // NÃO salvar QR code no banco - apenas retornar diretamente
      const hasQR = !!(qrResult?.base64 || qrResult?.pairingCode);
      return new Response(JSON.stringify({
        success: true,
        qr_code_base64: qrResult?.base64 || null,
        pairing_code: qrResult?.pairingCode || null,
        has_qr: hasQR,
        message: hasQR ? null : "A API não retornou QR Code. Tente novamente em alguns segundos.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // CHECK STATUS
    // =====================
    if (action === "status") {
      if (!instanceId) {
        throw new Error("instanceId é obrigatório");
      }

      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instanceId)
        .eq("organization_id", organizationId)
        .single();

      if (!instance?.evolution_instance_id) {
        throw new Error("Instância não encontrada");
      }

      const statusResponse = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instance.evolution_instance_id}`, {
        method: "GET",
        headers: { "apikey": EVOLUTION_API_KEY },
      });

      const statusResult = await statusResponse.json().catch(() => ({}));
      console.log("Status response:", statusResult);

      const isConnected = statusResult?.instance?.state === "open";
      const status = isConnected ? "connected" : (statusResult?.instance?.state || "pending");

      // Extrair número do telefone (Evolution v1: connectionState não traz ownerJid; precisamos do fetchInstances)
      let phoneNumber: string | null = instance.phone_number;

      // Tentativa 1: quando existir ownerJid (algumas builds podem enviar)
      const ownerJid = statusResult?.instance?.ownerJid;
      const fromOwnerJid = extractPhoneFromOwnerValue(ownerJid);
      if (fromOwnerJid) {
        phoneNumber = fromOwnerJid;
        console.log("Phone number extracted from ownerJid:", phoneNumber);
      }

      // Tentativa 2: fetchInstances (traz .instance.owner)
      if (isConnected && !phoneNumber) {
        const fetchedPhone = await fetchOwnerPhoneFromEvolution(instance.evolution_instance_id);
        if (fetchedPhone) {
          phoneNumber = fetchedPhone;
          console.log("Phone number fetched from fetchInstances:", phoneNumber);
        }
      }

      // Atualizar no banco incluindo phone_number
      await supabase
        .from("whatsapp_instances")
        .update({
          is_connected: isConnected,
          status: status,
          phone_number: phoneNumber,
        })
        .eq("id", instanceId);

      return new Response(JSON.stringify({
        success: true,
        is_connected: isConnected,
        status: status,
        raw: statusResult,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // ARCHIVE INSTANCE (SOFT DELETE - preserva histórico)
    // =====================
    if (action === "archive") {
      if (!instanceId) {
        throw new Error("instanceId é obrigatório");
      }

      // Verificar se é admin
      if (!["owner", "admin"].includes(membership.role)) {
        throw new Error("Apenas administradores podem arquivar instâncias");
      }

      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instanceId)
        .eq("organization_id", organizationId)
        .single();

      if (!instance) {
        throw new Error("Instância não encontrada");
      }

      if (instance.deleted_at) {
        throw new Error("Instância já está arquivada");
      }

      // Desconectar do Evolution se estiver conectada
      if (instance.evolution_instance_id && instance.is_connected) {
        try {
          await fetch(`${EVOLUTION_API_URL}/instance/logout/${instance.evolution_instance_id}`, {
            method: "DELETE",
            headers: { "apikey": EVOLUTION_API_KEY },
          });
        } catch (e) {
          console.error("Error logging out from Evolution:", e);
        }
      }

      // Preservar o nome da instância nas conversas
      await supabase
        .from("whatsapp_conversations")
        .update({ original_instance_name: instance.name })
        .eq("instance_id", instanceId)
        .is("original_instance_name", null);

      // Marcar a instância como arquivada (soft delete)
      const { error: updateError } = await supabase
        .from("whatsapp_instances")
        .update({
          deleted_at: new Date().toISOString(),
          is_connected: false,
          status: "archived",
        })
        .eq("id", instanceId);

      if (updateError) {
        throw new Error("Erro ao arquivar instância");
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Instância arquivada. O histórico de conversas foi preservado." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // UNARCHIVE INSTANCE (Restaurar instância arquivada)
    // =====================
    if (action === "unarchive") {
      if (!instanceId) {
        throw new Error("instanceId é obrigatório");
      }

      // Verificar se é admin
      if (!["owner", "admin"].includes(membership.role)) {
        throw new Error("Apenas administradores podem restaurar instâncias");
      }

      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instanceId)
        .eq("organization_id", organizationId)
        .single();

      if (!instance) {
        throw new Error("Instância não encontrada");
      }

      if (!instance.deleted_at) {
        throw new Error("Instância não está arquivada");
      }

      // Restaurar a instância
      const { error: updateError } = await supabase
        .from("whatsapp_instances")
        .update({
          deleted_at: null,
          status: "disconnected",
        })
        .eq("id", instanceId);

      if (updateError) {
        throw new Error("Erro ao restaurar instância");
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Instância restaurada. Use o QR Code para reconectar." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // DELETE INSTANCE (BLOQUEADO - usar archive)
    // =====================
    if (action === "delete") {
      throw new Error("Exclusão de instâncias não é permitida. Use 'arquivar' para preservar o histórico de conversas.");
    }

    // =====================
    // LOGOUT (DISCONNECT)
    // =====================
    if (action === "logout") {
      if (!instanceId) {
        throw new Error("instanceId é obrigatório");
      }

      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instanceId)
        .eq("organization_id", organizationId)
        .single();

      if (!instance?.evolution_instance_id) {
        throw new Error("Instância não encontrada");
      }

      await fetch(`${EVOLUTION_API_URL}/instance/logout/${instance.evolution_instance_id}`, {
        method: "DELETE",
        headers: { "apikey": EVOLUTION_API_KEY },
      });

      await supabase
        .from("whatsapp_instances")
        .update({ 
          is_connected: false,
          status: "disconnected",
          qr_code_base64: null,
          phone_number: null,
        })
        .eq("id", instanceId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // UPDATE EVOLUTION SETTINGS
    // =====================
    if (action === "update_settings") {
      if (!instanceId) {
        throw new Error("instanceId é obrigatório");
      }

      const { settings } = body;
      if (!settings) {
        throw new Error("settings é obrigatório");
      }

      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instanceId)
        .eq("organization_id", organizationId)
        .single();

      if (!instance?.evolution_instance_id) {
        throw new Error("Instância não encontrada");
      }

      console.log("Updating Evolution settings:", { instanceId: instance.evolution_instance_id, settings });

      // Atualizar settings no Evolution API
      const settingsResponse = await fetch(`${EVOLUTION_API_URL}/settings/set/${instance.evolution_instance_id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          rejectCall: settings.reject_call ?? true,
          msgCall: settings.msg_call ?? "Não posso atender agora, me envie uma mensagem.",
          groupsIgnore: settings.groups_ignore ?? false,
          alwaysOnline: settings.always_online ?? false,
          readMessages: settings.read_messages ?? true,
          readStatus: settings.read_status ?? false,
          syncFullHistory: settings.sync_full_history ?? false,
        }),
      });

      const settingsResult = await settingsResponse.json().catch(() => ({}));
      console.log("Evolution settings update result:", { status: settingsResponse.status, result: settingsResult });

      if (!settingsResponse.ok) {
        throw new Error(settingsResult?.message || settingsResult?.error || `Erro ao atualizar configurações: ${settingsResponse.status}`);
      }

      // Salvar no banco de dados
      const { error: updateError } = await supabase
        .from("whatsapp_instances")
        .update({
          evolution_settings: settings,
        })
        .eq("id", instanceId);

      if (updateError) {
        console.error("Error saving evolution_settings:", updateError);
        throw new Error("Erro ao salvar configurações no banco");
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Configurações atualizadas com sucesso" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // UPDATE GROUPS CONFIG
    // =====================
    if (action === "enable_groups") {
      if (!instanceId) {
        throw new Error("instanceId é obrigatório");
      }

      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instanceId)
        .eq("organization_id", organizationId)
        .single();

      if (!instance?.evolution_instance_id) {
        throw new Error("Instância não encontrada");
      }

      // Atualizar configurações da instância para receber grupos
      // (Evolution v2 usa /settings/set e /webhook/set)
      const webhookUrl = getWebhookUrl(instance.evolution_instance_id);

      const settingsResponse = await fetch(`${EVOLUTION_API_URL}/settings/set/${instance.evolution_instance_id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          groupsIgnore: false,
        }),
      });

      const settingsResult = await settingsResponse.json().catch(() => ({}));
      console.log("Enable groups settings result:", { status: settingsResponse.status, result: settingsResult });

      if (!settingsResponse.ok) {
        throw new Error(settingsResult?.message || settingsResult?.error || `Erro ao habilitar grupos (settings): ${settingsResponse.status}`);
      }

      const webhookSetResponse = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instance.evolution_instance_id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          url: webhookUrl,
          byEvents: false,
          base64: true,
          headers: {
            "Content-Type": "application/json",
          },
          events: [
            "MESSAGES_UPSERT",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
            "GROUPS_UPSERT",
          ],
        }),
      });

      const webhookSetResult = await webhookSetResponse.json().catch(() => ({}));
      console.log("Enable groups webhook set result:", { status: webhookSetResponse.status, result: webhookSetResult });

      if (!webhookSetResponse.ok) {
        throw new Error(webhookSetResult?.message || webhookSetResult?.error || `Erro ao habilitar grupos (webhook): ${webhookSetResponse.status}`);
      }
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Grupos habilitados na instância" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // ADD MANUAL INSTANCE (from existing Evolution instance)
    // =====================
    if (action === "add_manual") {
      // Usar os campos já extraídos do body parseado no início da função
      const manualInstanceId = evolution_instance_id;
      const manualToken = evolution_api_token;
      const manualPhoneNumber = phone_number;
      const manualName = name || manualInstanceId;

      if (!manualInstanceId) {
        throw new Error("ID da instância (evolution_instance_id) é obrigatório");
      }

      console.log("Adding manual Evolution instance:", { manualInstanceId, manualName, organizationId });

      // Verificar se instância já existe no banco
      const { data: existing } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("evolution_instance_id", manualInstanceId)
        .single();

      if (existing) {
        throw new Error("Esta instância já está cadastrada no sistema");
      }

      // Verificar se a instância existe no Evolution API e está conectada
      let isConnected = false;
      let phoneFromEvolution: string | null = manualPhoneNumber || null;

      try {
        const statusResponse = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${manualInstanceId}`, {
          method: "GET",
          headers: { "apikey": EVOLUTION_API_KEY },
        });

        if (statusResponse.ok) {
          const statusResult = await statusResponse.json().catch(() => ({}));
          console.log("Manual instance status:", statusResult);
          isConnected = statusResult?.instance?.state === "open";

          // Tentativa 1: ownerJid (quando vier)
          const fromOwnerJid = extractPhoneFromOwnerValue(statusResult?.instance?.ownerJid);
          if (fromOwnerJid) {
            phoneFromEvolution = fromOwnerJid;
          }

          // Tentativa 2: fetchInstances (traz .instance.owner)
          if (isConnected && !phoneFromEvolution) {
            phoneFromEvolution = await fetchOwnerPhoneFromEvolution(manualInstanceId);
          }
        }
      } catch (e) {
        console.warn("Could not verify instance in Evolution:", e);
      }

      // Configurar webhook E settings para a instância manual
      const webhookUrl = getWebhookUrl(manualInstanceId);
      
      // Primeiro, garantir que grupos NÃO serão ignorados (settings)
      try {
        const settingsRes = await fetch(`${EVOLUTION_API_URL}/settings/set/${manualInstanceId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            groupsIgnore: false,
          }),
        });
        console.log("Settings configured for manual instance:", manualInstanceId, await settingsRes.json().catch(() => ({})));
      } catch (e) {
        console.warn("Could not configure settings:", e);
      }
      
      // Depois, configurar webhook com todos os eventos necessários
      try {
        await fetch(`${EVOLUTION_API_URL}/webhook/set/${manualInstanceId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            url: webhookUrl,
            byEvents: false,
            base64: true,
            headers: {
              "Content-Type": "application/json",
            },
            events: [
              "MESSAGES_UPSERT",
              "CONNECTION_UPDATE",
              "QRCODE_UPDATED",
              "GROUPS_UPSERT",
            ],
          }),
        });
        console.log("Webhook configured for manual instance:", manualInstanceId);
      } catch (e) {
        console.warn("Could not configure webhook:", e);
      }

      // Salvar no banco de dados
      const { data: instance, error: insertError } = await supabase
        .from("whatsapp_instances")
        .insert({
          organization_id: organizationId,
          name: manualName,
          provider: "evolution",
          evolution_instance_id: manualInstanceId,
          evolution_api_token: manualToken || null,
          evolution_webhook_configured: true,
          status: isConnected ? "connected" : "pending",
          is_connected: isConnected,
          phone_number: phoneFromEvolution,
          monthly_price_cents: 0,
          payment_source: "admin_grant",
          manual_instance_number: manual_instance_number || null,
          manual_device_label: manual_device_label || null,
          display_name_for_team: display_name_for_team || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error saving manual instance:", insertError);
        throw new Error("Erro ao salvar instância: " + insertError.message);
      }

      return new Response(JSON.stringify({
        success: true,
        instance,
        message: isConnected ? "Instância adicionada e conectada!" : "Instância adicionada. Configure o QR Code para conectar.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // CREATE INSTAGRAM INSTANCE
    // =====================
    if (action === "create_instagram") {
      if (!name) {
        throw new Error("Nome da instância é obrigatório");
      }

      const evolutionInstanceName = generateInstanceName(organizationId, name);
      const webhookUrl = `${SUPABASE_URL}/functions/v1/evolution-instagram-webhook`;

      console.log("Creating Instagram Evolution instance:", { evolutionInstanceName, webhookUrl });

      // 1. Criar instância no Evolution API com integration INSTAGRAM
      const createResponse = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          instanceName: evolutionInstanceName,
          integration: "INSTAGRAM",
          qrcode: false, // Instagram usa OAuth, não QR
          webhook: {
            url: webhookUrl,
            byEvents: false,
            base64: true,
            headers: {
              "Content-Type": "application/json",
            },
            events: [
              "MESSAGES_UPSERT",
              "CONNECTION_UPDATE",
              "SEND_MESSAGE",
            ],
          },
        }),
      });

      const createResult = await createResponse.json().catch(() => ({}));
      console.log("Instagram Evolution create response:", { status: createResponse.status, result: createResult });

      if (!createResponse.ok) {
        throw new Error(createResult?.message || createResult?.error || `Erro ao criar instância Instagram: ${createResponse.status}`);
      }

      // 2. Salvar no banco de dados com channel_type = 'instagram'
      const { data: instance, error: insertError } = await supabase
        .from("whatsapp_instances")
        .insert({
          organization_id: organizationId,
          name: name,
          provider: "evolution",
          evolution_instance_id: evolutionInstanceName,
          evolution_api_token: createResult?.hash || createResult?.token || null,
          evolution_webhook_configured: true,
          status: "pending_oauth",
          is_connected: false,
          monthly_price_cents: 0,
          payment_source: "admin_grant",
          channel_type: "instagram",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error saving Instagram instance:", insertError);
        // Tentar deletar a instância criada no Evolution
        await fetch(`${EVOLUTION_API_URL}/instance/delete/${evolutionInstanceName}`, {
          method: "DELETE",
          headers: { "apikey": EVOLUTION_API_KEY },
        });
        throw new Error("Erro ao salvar instância no banco");
      }

      // 3. Buscar URL de autenticação OAuth do Instagram
      let oauthUrl: string | null = null;
      try {
        const oauthResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${evolutionInstanceName}`, {
          method: "GET",
          headers: { "apikey": EVOLUTION_API_KEY },
        });
        
        const oauthResult = await oauthResponse.json().catch(() => ({}));
        console.log("Instagram OAuth response:", { status: oauthResponse.status, hasUrl: !!oauthResult?.oauthUrl });
        oauthUrl = oauthResult?.oauthUrl || oauthResult?.url || null;
      } catch (e) {
        console.warn("Could not get Instagram OAuth URL:", e);
      }

      return new Response(JSON.stringify({
        success: true,
        instance: instance,
        oauth_url: oauthUrl,
        message: oauthUrl 
          ? "Instância criada! Clique no link para conectar sua conta Instagram." 
          : "Instância criada. Acesse a Evolution API para configurar o OAuth do Instagram.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // GET INSTAGRAM OAUTH URL
    // =====================
    if (action === "get_instagram_oauth") {
      if (!instanceId) {
        throw new Error("instanceId é obrigatório");
      }

      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instanceId)
        .eq("organization_id", organizationId)
        .single();

      if (!instance?.evolution_instance_id) {
        throw new Error("Instância não encontrada");
      }

      if (instance.channel_type !== "instagram") {
        throw new Error("Esta instância não é do tipo Instagram");
      }

      // Buscar URL OAuth
      const oauthResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instance.evolution_instance_id}`, {
        method: "GET",
        headers: { "apikey": EVOLUTION_API_KEY },
      });

      const oauthResult = await oauthResponse.json().catch(() => ({}));
      console.log("Instagram OAuth URL response:", oauthResult);

      const oauthUrl = oauthResult?.oauthUrl || oauthResult?.url || null;

      return new Response(JSON.stringify({
        success: true,
        oauth_url: oauthUrl,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // LIST INSTANCES
    // =====================
    if (action === "list") {
      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      // Backfill rápido do phone_number para instâncias conectadas (sem depender do payload do connectionState)
      const list = (instances || []) as any[];
      const needsBackfill = list.some((i) => i?.provider === "evolution" && i?.is_connected && !i?.phone_number && i?.evolution_instance_id);

      if (needsBackfill) {
        try {
          const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
            method: "GET",
            headers: { apikey: EVOLUTION_API_KEY },
          });

          if (res.ok) {
            const items = (await res.json().catch(() => [])) as any[];
            for (const inst of list) {
              if (inst?.provider !== "evolution" || !inst?.is_connected || inst?.phone_number || !inst?.evolution_instance_id) continue;

              const found = items.find((it) => it?.instance?.instanceName === inst.evolution_instance_id);
              const phone = extractPhoneFromOwnerValue(found?.instance?.owner ?? found?.instance?.ownerJid);
              if (!phone) continue;

              inst.phone_number = phone;
              await supabase.from("whatsapp_instances").update({ phone_number: phone }).eq("id", inst.id);
            }
          }
        } catch (e) {
          console.warn("list backfill phone_number failed:", e);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        instances: list,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Ação desconhecida: ${action}`);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("evolution-instance-manager error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
