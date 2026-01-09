import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    const { action, instanceId, name, evolution_instance_id, evolution_api_token, phone_number } = body;

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

      console.log("Creating Evolution instance:", { evolutionInstanceName, webhookUrl });

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
          rejectCall: true,
          msgCall: "Não posso atender agora, me envie uma mensagem.",
          groupsIgnore: false, // IMPORTANTE: Receber mensagens de grupos
          alwaysOnline: false,
          readMessages: true,
          readStatus: false,
          syncFullHistory: false,
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
      // Garantimos explicitamente que grupos NÃO serão ignorados.
      try {
        const settingsResponse = await fetch(`${EVOLUTION_API_URL}/settings/set/${evolutionInstanceName}`, {
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

      // Buscar QR Code
      const qrResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instance.evolution_instance_id}`, {
        method: "GET",
        headers: { "apikey": EVOLUTION_API_KEY },
      });

      const qrResult = await qrResponse.json().catch(() => ({}));
      console.log("QR Code response:", { status: qrResponse.status, hasBase64: !!qrResult?.base64, hasPairingCode: !!qrResult?.pairingCode });

      // NÃO salvar QR code no banco - apenas retornar diretamente
      return new Response(JSON.stringify({
        success: true,
        qr_code_base64: qrResult?.base64 || null,
        pairing_code: qrResult?.pairingCode || null,
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

      // Atualizar no banco
      await supabase
        .from("whatsapp_instances")
        .update({ 
          is_connected: isConnected,
          status: status,
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
    // DELETE INSTANCE
    // =====================
    if (action === "delete") {
      if (!instanceId) {
        throw new Error("instanceId é obrigatório");
      }

      // Verificar se é admin
      if (!["owner", "admin"].includes(membership.role)) {
        throw new Error("Apenas administradores podem deletar instâncias");
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

      // Deletar no Evolution se existir
      if (instance.evolution_instance_id) {
        try {
          await fetch(`${EVOLUTION_API_URL}/instance/delete/${instance.evolution_instance_id}`, {
            method: "DELETE",
            headers: { "apikey": EVOLUTION_API_KEY },
          });
        } catch (e) {
          console.error("Error deleting from Evolution:", e);
        }
      }

      // Deletar do banco
      const { error: deleteError } = await supabase
        .from("whatsapp_instances")
        .delete()
        .eq("id", instanceId);

      if (deleteError) {
        throw new Error("Erro ao deletar instância");
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      let phoneFromEvolution = manualPhoneNumber || null;
      
      try {
        const statusResponse = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${manualInstanceId}`, {
          method: "GET",
          headers: { "apikey": EVOLUTION_API_KEY },
        });
        
        if (statusResponse.ok) {
          const statusResult = await statusResponse.json().catch(() => ({}));
          console.log("Manual instance status:", statusResult);
          isConnected = statusResult?.instance?.state === "open";
          
          // Tentar pegar número do status
          if (statusResult?.instance?.ownerJid) {
            phoneFromEvolution = statusResult.instance.ownerJid.split("@")[0];
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
    // LIST INSTANCES
    // =====================
    if (action === "list") {
      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify({
        success: true,
        instances: instances || [],
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
