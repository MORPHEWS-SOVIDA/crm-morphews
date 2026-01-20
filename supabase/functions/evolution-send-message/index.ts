import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AdminConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  phone_number?: string;
  is_connected?: boolean;
}

async function getAdminWhatsAppConfig(): Promise<AdminConfig | null> {
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "admin_whatsapp_instance")
      .single();

    if (data?.value) {
      return data.value as AdminConfig;
    }
    return null;
  } catch (error) {
    console.error("Error fetching admin whatsapp config:", error);
    return null;
  }
}

function normalizeWhatsApp(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (!clean.startsWith("55")) clean = `55${clean}`;
  if (clean.length === 12 && clean.startsWith("55")) {
    clean = clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      phone, 
      message, 
      instanceId,           // UUID da instância no banco (para instâncias de org)
      evolutionInstanceId,  // Nome da instância no Evolution (alternativo)
      mediaUrl,
      mediaType,
      fileName,
      useAdminInstance,     // Se true, usa a instância administrativa
    } = await req.json();

    if (!phone) {
      throw new Error("phone é obrigatório");
    }

    if (!message && !mediaUrl) {
      throw new Error("message ou mediaUrl é obrigatório");
    }

    const normalizedPhone = normalizeWhatsApp(phone);
    if (!normalizedPhone) {
      throw new Error("Telefone inválido");
    }

    let apiUrl: string = "";
    let apiKey: string = "";
    let targetInstanceName: string = "";

    // Se useAdminInstance = true ou não passou instanceId/evolutionInstanceId, usa a instância admin
    if (useAdminInstance || (!instanceId && !evolutionInstanceId)) {
      const adminConfig = await getAdminWhatsAppConfig();
      
      if (!adminConfig || !adminConfig.api_url || !adminConfig.api_key || !adminConfig.instance_name) {
        throw new Error("Instância WhatsApp administrativa não configurada. Configure em Super Admin > WhatsApp Admin.");
      }

      apiUrl = adminConfig.api_url.replace(/\/$/, ""); // Remove trailing slash
      apiKey = adminConfig.api_key;
      targetInstanceName = adminConfig.instance_name;
      
      console.log("Usando instância administrativa:", targetInstanceName);
    } else {
      // Usa instância específica da organização
      if (evolutionInstanceId) {
        targetInstanceName = evolutionInstanceId;
      } else if (instanceId) {
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("evolution_instance_id, evolution_api_url, evolution_api_key")
          .eq("id", instanceId)
          .single();

        if (!instance?.evolution_instance_id) {
          throw new Error("Instância não encontrada");
        }
        
        targetInstanceName = instance.evolution_instance_id;
        
        // Se a instância tem API própria configurada, usa ela
        if (instance.evolution_api_url && instance.evolution_api_key) {
          apiUrl = instance.evolution_api_url.replace(/\/$/, "");
          apiKey = instance.evolution_api_key;
        }
      }

      // Se não definiu apiUrl/apiKey, busca da instância admin como fallback
      if (!apiUrl! || !apiKey!) {
        const adminConfig = await getAdminWhatsAppConfig();
        if (!adminConfig?.api_url || !adminConfig?.api_key) {
          throw new Error("Configuração de API Evolution não encontrada");
        }
        apiUrl = adminConfig.api_url.replace(/\/$/, "");
        apiKey = adminConfig.api_key;
      }
    }

    if (!targetInstanceName) {
      throw new Error("Nenhuma instância Evolution configurada");
    }

    console.log("Enviando mensagem Evolution:", { 
      phone: normalizedPhone, 
      instanceName: targetInstanceName,
      apiUrl,
      hasMedia: !!mediaUrl,
    });

    let url: string;
    let body: Record<string, any>;

    // Enviar texto ou mídia
    if (mediaUrl) {
      url = `${apiUrl}/message/sendMedia/${targetInstanceName}`;
      body = {
        number: normalizedPhone,
        mediatype: mediaType || "image",
        media: mediaUrl,
        caption: message || "",
        fileName: fileName || undefined,
      };
    } else {
      url = `${apiUrl}/message/sendText/${targetInstanceName}`;
      body = {
        number: normalizedPhone,
        text: message,
      };
    }

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
      },
      body: JSON.stringify(body),
    });

    const raw = await resp.json().catch(() => ({}));

    console.log("Resposta Evolution:", { status: resp.status, raw });

    if (!resp.ok) {
      throw new Error(raw?.message || raw?.error || `HTTP ${resp.status}`);
    }

    return new Response(JSON.stringify({ success: true, raw }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("evolution-send-message error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
