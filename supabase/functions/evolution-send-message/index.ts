import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  
  // Se o número já tem um código de país diferente de 55 (internacional)
  // e tem >= 10 dígitos, preservar como está
  if (!clean.startsWith("55") && clean.length >= 10) {
    return clean; // número internacional - não adicionar 55
  }
  
  // Número brasileiro: garantir prefixo 55
  if (!clean.startsWith("55")) clean = `55${clean}`;
  // Se tem 12 dígitos (55 + DD + 8), adiciona o 9 (celular)
  if (clean.length === 12 && clean.startsWith("55")) {
    clean = clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
        console.log('[evolution-send-message] Buscando instância por ID:', instanceId);
        
        const { data: instance, error: instanceError } = await supabase
          .from("whatsapp_instances")
          .select("evolution_instance_id, evolution_api_token")
          .eq("id", instanceId)
          .single();

        console.log('[evolution-send-message] Resultado query:', { instance, error: instanceError });

        if (instanceError) {
          console.error('[evolution-send-message] Erro ao buscar instância:', instanceError);
          throw new Error(`Erro ao buscar instância: ${instanceError.message}`);
        }

        if (!instance?.evolution_instance_id) {
          throw new Error("Instância não encontrada ou sem evolution_instance_id");
        }
        
        targetInstanceName = instance.evolution_instance_id;
        
        // Se a instância tem token próprio, usar ele (mas URL vem da config admin)
        if (instance.evolution_api_token) {
          apiKey = instance.evolution_api_token;
        }
      }

      // Sempre buscar a URL da config admin (é a mesma para todas as instâncias)
      const adminConfig = await getAdminWhatsAppConfig();
      if (!adminConfig?.api_url) {
        throw new Error("URL da API Evolution não configurada. Configure em Super Admin > WhatsApp Admin.");
      }
      apiUrl = adminConfig.api_url.replace(/\/$/, "");
      
      // Se não tem apiKey ainda (instância não tem token próprio), usar o admin
      if (!apiKey) {
        if (!adminConfig?.api_key) {
          throw new Error("API Key da Evolution não configurada");
        }
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
