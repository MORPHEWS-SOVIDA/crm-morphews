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
const EVOLUTION_INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
      instanceId,           // UUID da instância no banco
      evolutionInstanceId,  // Nome da instância no Evolution (alternativo)
      mediaUrl,
      mediaType,
      fileName,
    } = await req.json();

    if (!phone) {
      throw new Error("phone é obrigatório");
    }

    if (!message && !mediaUrl) {
      throw new Error("message ou mediaUrl é obrigatório");
    }

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error("Evolution API credentials not configured");
    }

    const normalizedPhone = normalizeWhatsApp(phone);
    if (!normalizedPhone) {
      throw new Error("Telefone inválido");
    }

    // Determinar qual instância usar
    let targetInstanceName = evolutionInstanceId || EVOLUTION_INSTANCE_NAME;

    // Se passou instanceId (UUID), buscar o nome da instância no banco
    if (instanceId && !evolutionInstanceId) {
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("evolution_instance_id")
        .eq("id", instanceId)
        .single();

      if (instance?.evolution_instance_id) {
        targetInstanceName = instance.evolution_instance_id;
      }
    }

    if (!targetInstanceName) {
      throw new Error("Nenhuma instância Evolution configurada");
    }

    console.log("Enviando mensagem Evolution:", { 
      phone: normalizedPhone, 
      instanceName: targetInstanceName,
      hasMedia: !!mediaUrl,
    });

    let url: string;
    let body: Record<string, any>;

    // Enviar texto ou mídia
    if (mediaUrl) {
      url = `${EVOLUTION_API_URL}/message/sendMedia/${targetInstanceName}`;
      body = {
        number: normalizedPhone,
        mediatype: mediaType || "image",
        media: mediaUrl,
        caption: message || "",
        fileName: fileName || undefined,
      };
    } else {
      url = `${EVOLUTION_API_URL}/message/sendText/${targetInstanceName}`;
      body = {
        number: normalizedPhone,
        text: message,
      };
    }

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY,
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
