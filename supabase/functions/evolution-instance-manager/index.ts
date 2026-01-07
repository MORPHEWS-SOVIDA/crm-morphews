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
    const { action, instanceId, name } = await req.json();

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
          groupsIgnore: true,
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
            ],
          },
        }),
      });

      const createResult = await createResponse.json().catch(() => ({}));
      console.log("Evolution create response:", { status: createResponse.status, result: createResult });

      if (!createResponse.ok) {
        throw new Error(createResult?.message || createResult?.error || `Erro ao criar instância: ${createResponse.status}`);
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
          payment_source: "free",
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

      // 3. Buscar QR Code
      const qrResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${evolutionInstanceName}`, {
        method: "GET",
        headers: { "apikey": EVOLUTION_API_KEY },
      });

      const qrResult = await qrResponse.json().catch(() => ({}));
      console.log("QR Code response:", { status: qrResponse.status, hasBase64: !!qrResult?.base64 });

      if (qrResult?.base64) {
        await supabase
          .from("whatsapp_instances")
          .update({ qr_code_base64: qrResult.base64 })
          .eq("id", instance.id);
      }

      return new Response(JSON.stringify({
        success: true,
        instance: {
          ...instance,
          qr_code_base64: qrResult?.base64 || null,
        },
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

      // Atualizar no banco
      if (qrResult?.base64) {
        await supabase
          .from("whatsapp_instances")
          .update({ qr_code_base64: qrResult.base64 })
          .eq("id", instanceId);
      }

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
