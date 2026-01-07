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
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalizeWhatsApp(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (!clean.startsWith("55")) clean = `55${clean}`;
  // Add 9th digit if needed (12 digits should become 13)
  if (clean.length === 12 && clean.startsWith("55")) {
    clean = clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
}

async function sendEvolutionText(
  toPhone: string,
  message: string
): Promise<{ ok: boolean; error?: string; raw?: any }> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
    return { ok: false, error: "Evolution API credentials not configured" };
  }

  const phone = normalizeWhatsApp(toPhone);
  if (!phone) return { ok: false, error: "Invalid phone" };

  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    const raw = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return {
        ok: false,
        error: raw?.message || raw?.error || `HTTP ${resp.status}`,
        raw,
      };
    }

    return { ok: true, raw };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

async function reply(toPhone: string, message: string) {
  const res = await sendEvolutionText(toPhone, message);
  if (!res.ok) {
    console.error("Evolution API send error:", {
      toPhone,
      error: res.error,
      raw: res.raw,
    });
  }
  return res;
}

type ParsedCommand =
  | {
      action: "create_lead";
      lead_phone: string;
      lead_name?: string;
      stars?: number;
      cep?: string;
      notes?: string;
    }
  | {
      action: "unknown";
      reply?: string;
    };

function parseCommandFallback(text: string): ParsedCommand {
  const lower = (text || "").toLowerCase();

  const isCreate = /(cadastrar|adicionar)\s+lead/.test(lower);
  if (!isCreate) {
    return { action: "unknown" };
  }

  const phoneMatch = (text || "").match(/(\d{10,13})/);
  const leadPhone = phoneMatch?.[1] || "";

  let leadName: string | undefined;
  const nameMatch = (text || "").match(/\bnome\b\s+([^\n]+?)(?=(\bcolocar\b|\bcep\b|\bestrel|$))/i);
  if (nameMatch?.[1]) leadName = nameMatch[1].trim();

  const starsMatch = (text || "").match(/(\d)\s*estrel/i);
  const stars = starsMatch?.[1] ? Number(starsMatch[1]) : undefined;

  const cepMatch = (text || "").match(/\bcep\b\s*(\d{8})/i);
  const cep = cepMatch?.[1];

  return {
    action: "create_lead",
    lead_phone: leadPhone,
    lead_name: leadName,
    stars: Number.isFinite(stars) ? stars : undefined,
    cep,
    notes: text,
  };
}

async function parseCommandWithAI(text: string): Promise<ParsedCommand | null> {
  if (!LOVABLE_API_KEY) return null;

  const system = `Você é um parser de comandos do WhatsApp para um CRM.
Retorne SOMENTE JSON válido (sem markdown) com a estrutura:
- {"action":"create_lead","lead_phone":"...","lead_name":"...","stars":5,"cep":"91781200","notes":"..."}
- {"action":"unknown","reply":"..."}

Regras:
- lead_phone deve conter apenas dígitos (pode vir com 55 ou sem).
- stars deve ser número de 1 a 5 se presente.
- cep deve ter 8 dígitos se presente.
- Se não for comando de cadastrar/adicionar lead, action="unknown".

Exemplos:
"Cadastrar lead 5551999908088 nome Guilherme ruivo colocar 5 estrelas e endereço cep 91781200" => create_lead
"Oi" => unknown`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return null;

    const parsed = JSON.parse(content);
    if (!parsed?.action) return null;

    if (parsed.action === "create_lead") {
      return {
        action: "create_lead",
        lead_phone: String(parsed.lead_phone || ""),
        lead_name: parsed.lead_name ? String(parsed.lead_name) : undefined,
        stars: typeof parsed.stars === "number" ? parsed.stars : undefined,
        cep: parsed.cep ? String(parsed.cep) : undefined,
        notes: parsed.notes ? String(parsed.notes) : undefined,
      };
    }

    return { action: "unknown", reply: parsed.reply ? String(parsed.reply) : undefined };
  } catch (e) {
    console.error("AI parse error:", e);
    return null;
  }
}

async function findLeadByPhone(organizationId: string, phone: string) {
  const normalized = normalizeWhatsApp(phone);
  if (!normalized) return null;

  const variants = [
    normalized,
    normalized.replace(/^55/, ""),
    normalized.length === 13 ? normalized.slice(0, 4) + normalized.slice(5) : null,
    normalized.length === 12 ? normalized.slice(0, 4) + "9" + normalized.slice(4) : null,
  ].filter(Boolean) as string[];

  for (const v of variants) {
    const { data } = await supabase
      .from("leads")
      .select("id, name, whatsapp")
      .eq("organization_id", organizationId)
      .or(`whatsapp.ilike.%${v}%,secondary_phone.ilike.%${v}%`)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

function pickFirstString(...values: any[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

// Evolution API webhook payload structure
function extractIncoming(body: any): { event: string; fromPhoneRaw: string; text: string; isFromMe: boolean } {
  // Evolution API sends different event types
  const event = String(body?.event || body?.type || "");
  
  // Evolution API message structure
  const data = body?.data || body;
  const key = data?.key || {};
  const message = data?.message || {};
  
  // Get sender phone from remoteJid (format: 5551999999999@s.whatsapp.net)
  const remoteJid = key?.remoteJid || data?.remoteJid || "";
  const fromPhoneRaw = remoteJid.split("@")[0] || "";
  
  // Get message text - Evolution API can send in different fields
  const text = pickFirstString(
    message?.conversation,
    message?.extendedTextMessage?.text,
    message?.text,
    data?.body,
    data?.text
  );
  
  // Check if message is from the instance itself
  const isFromMe = key?.fromMe === true || data?.fromMe === true;

  return { event, fromPhoneRaw, text, isFromMe };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const { event, fromPhoneRaw, text, isFromMe } = extractIncoming(body);

    console.log("Evolution assistant webhook received:", {
      event,
      fromPhoneRaw,
      textPreview: String(text || "").substring(0, 160),
      isFromMe,
      topLevelKeys: Object.keys(body || {}).slice(0, 40),
    });

    // Ignore status/ack events without message content
    const isStatusEvent = ["messages.update", "connection.update", "qrcode.updated"].includes(event);
    if (isStatusEvent) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ignore messages from the instance itself
    if (isFromMe) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromPhone = normalizeWhatsApp(String(fromPhoneRaw || ""));
    if (!fromPhone) {
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map sender -> user -> organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, organization_id, first_name")
      .eq("whatsapp", fromPhone)
      .maybeSingle();

    if (profileError) console.error("Profile lookup error:", profileError);

    if (!profile?.user_id || !profile?.organization_id) {
      await reply(
        fromPhone,
        "Não consegui vincular seu número a uma empresa no Morphews. Por favor, procure o SUPORTE DA MORPHEWS para validar seu WhatsApp no cadastro."
      );
      return new Response(JSON.stringify({ success: true, unlinked: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = profile.organization_id;
    const userId = profile.user_id;

    const rawText = String(text || "").trim();
    if (!rawText) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parser (AI -> fallback)
    const aiParsed = await parseCommandWithAI(rawText);
    const parsed = aiParsed || parseCommandFallback(rawText);

    if (parsed.action !== "create_lead") {
      await reply(
        fromPhone,
        parsed.action === "unknown" && parsed.reply
          ? parsed.reply
          : 'Não entendi. Exemplo: "Cadastrar lead 51999998888 nome João"'
      );
      return new Response(JSON.stringify({ success: true, action: "unknown" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leadPhoneNorm = normalizeWhatsApp(parsed.lead_phone || "");
    if (!leadPhoneNorm) {
      await reply(fromPhone, "Não encontrei o WhatsApp do lead. Exemplo: Cadastrar lead 51999998888 nome João");
      return new Response(JSON.stringify({ success: true, error: "missing_lead_phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Avoid duplicating lead
    const existing = await findLeadByPhone(organizationId, leadPhoneNorm);
    if (existing) {
      await reply(fromPhone, `✅ Lead já existe: *${existing.name}* (${existing.whatsapp}).`);
      return new Response(JSON.stringify({ success: true, action: "exists", lead_id: existing.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leadName = (parsed.lead_name || "").trim() || `Lead ${leadPhoneNorm.replace(/^55/, "")}`;
    const stars = typeof parsed.stars === "number" && parsed.stars >= 1 && parsed.stars <= 5 ? parsed.stars : undefined;
    const cep = parsed.cep && /^\d{8}$/.test(parsed.cep) ? parsed.cep : undefined;

    const { data: newLead, error: leadError } = await supabase
      .from("leads")
      .insert({
        organization_id: organizationId,
        assigned_to: userId,
        name: leadName,
        whatsapp: leadPhoneNorm,
        stars: stars ?? 0,
        cep: cep ?? null,
        observations: parsed.notes || null,
      })
      .select("id, name, whatsapp")
      .single();

    if (leadError) {
      console.error("Lead create error:", leadError);
      await reply(fromPhone, "❌ Não consegui cadastrar o lead agora. Tente novamente em alguns minutos.");
      return new Response(JSON.stringify({ success: false, error: leadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const confirm = `✅ Lead cadastrado com sucesso!\n\n• Nome: *${newLead.name}*\n• WhatsApp: ${newLead.whatsapp}${stars ? `\n• Estrelas: ${stars}` : ""}${cep ? `\n• CEP: ${cep}` : ""}`;
    await reply(fromPhone, confirm);

    return new Response(JSON.stringify({ success: true, action: "create_lead", lead_id: newLead.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("evolution-assistant-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
