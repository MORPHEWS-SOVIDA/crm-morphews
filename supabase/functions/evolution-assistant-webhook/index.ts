import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeWhatsApp(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (!clean.startsWith("55")) clean = `55${clean}`;
  return clean;
}

// Returns both possible formats: with and without 9th digit
function getWhatsAppVariants(phone: string): string[] {
  const clean = normalizeWhatsApp(phone);
  if (!clean) return [];
  
  const variants: string[] = [clean];
  
  // If 12 digits (without 9th digit), also try with 9
  if (clean.length === 12 && clean.startsWith("55")) {
    variants.push(clean.slice(0, 4) + "9" + clean.slice(4));
  }
  
  // If 13 digits (with 9th digit), also try without 9
  if (clean.length === 13 && clean.startsWith("55") && clean[4] === "9") {
    variants.push(clean.slice(0, 4) + clean.slice(5));
  }
  
  return variants;
}

async function getAdminInstanceConfig(): Promise<{
  apiUrl: string;
  apiKey: string;
  instanceName: string;
} | null> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "admin_whatsapp_instance")
    .maybeSingle();

  if (!data?.value) return null;

  return {
    apiUrl: data.value.api_url || "",
    apiKey: data.value.api_key || "",
    instanceName: data.value.instance_name || "",
  };
}

async function sendEvolutionText(
  toPhone: string,
  message: string
): Promise<{ ok: boolean; error?: string; raw?: any }> {
  const config = await getAdminInstanceConfig();
  if (!config || !config.apiUrl || !config.apiKey || !config.instanceName) {
    console.error("Admin instance not configured");
    return { ok: false, error: "Admin WhatsApp instance not configured" };
  }

  const phone = normalizeWhatsApp(toPhone);
  if (!phone) return { ok: false, error: "Invalid phone" };

  const baseUrl = config.apiUrl.replace(/\/$/, "");
  const url = `${baseUrl}/message/sendText/${config.instanceName}`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.apiKey,
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

// ============================================================================
// MEDIA DOWNLOAD & AI PROCESSING
// ============================================================================

async function downloadMediaFromEvolution(
  messageKey: { id: string; remoteJid?: string; fromMe?: boolean }
): Promise<{ base64: string; mimeType: string } | null> {
  const config = await getAdminInstanceConfig();
  if (!config || !config.apiUrl || !config.apiKey || !config.instanceName) {
    console.error("❌ Admin instance not configured for media download");
    return null;
  }

  try {
    const baseUrl = config.apiUrl.replace(/\/$/, "");
    const endpoint = `${baseUrl}/chat/getBase64FromMediaMessage/${config.instanceName}`;
    
    console.log("📥 Fetching media from Evolution:", {
      instance: config.instanceName,
      messageId: messageKey.id,
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.apiKey,
      },
      body: JSON.stringify({
        message: { key: messageKey },
        convertToMp4: false,
      }),
    });

    if (!response.ok) {
      console.error("❌ Evolution getBase64 failed:", response.status, await response.text().catch(() => ""));
      return null;
    }

    const result = await response.json();
    
    if (result?.base64) {
      console.log("✅ Media downloaded from Evolution:", {
        hasBase64: true,
        mimeType: result.mimetype || "unknown",
        size: result.base64.length,
      });
      return {
        base64: result.base64,
        mimeType: result.mimetype || "application/octet-stream",
      };
    }

    console.log("⚠️ Evolution returned no base64:", Object.keys(result || {}));
    return null;
  } catch (error) {
    console.error("❌ Error downloading media from Evolution:", error);
    return null;
  }
}

async function transcribeAudioWithGroq(base64: string, mimeType: string): Promise<string | null> {
  if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY not configured");
    return null;
  }

  try {
    console.log("🎤 Transcribing audio with Groq Whisper...", { mimeType, size: base64.length });
    
    // Determine file extension from mimetype
    let ext = "ogg";
    if (mimeType.includes("mp4") || mimeType.includes("m4a")) ext = "m4a";
    else if (mimeType.includes("mp3") || mimeType.includes("mpeg")) ext = "mp3";
    else if (mimeType.includes("wav")) ext = "wav";
    else if (mimeType.includes("webm")) ext = "webm";
    else if (mimeType.includes("ogg")) ext = "ogg";

    // Convert base64 to binary
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    
    // Create FormData for Groq Whisper API
    const formData = new FormData();
    formData.append("file", blob, `audio.${ext}`);
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("language", "pt");
    formData.append("response_format", "text");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Groq Whisper transcription failed:", response.status, errText);
      return null;
    }

    const transcription = await response.text();
    
    console.log("✅ Audio transcribed with Groq Whisper:", transcription.substring(0, 100) + (transcription.length > 100 ? "..." : ""));
    return transcription.trim();
  } catch (error) {
    console.error("❌ Error transcribing audio with Groq:", error);
    return null;
  }
}

async function analyzeImageWithAI(base64: string, mimeType: string): Promise<{
  leadName?: string;
  instagram?: string;
  followers?: string;
  email?: string;
  phone?: string;
  notes?: string;
  rawText: string;
} | null> {
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return null;
  }

  try {
    console.log("📸 Analyzing image with AI...", { mimeType, size: base64.length });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um assistente que extrai dados de leads a partir de imagens.
Analise a imagem (pode ser um print de Instagram, LinkedIn, perfil de contato, etc.) e extraia:
- Nome da pessoa/empresa
- @ do Instagram (se visível)
- Número de seguidores (se visível)
- Email (se visível)
- Telefone (se visível)
- Qualquer informação relevante para vendas

Retorne APENAS JSON válido no formato:
{
  "leadName": "Nome encontrado ou null",
  "instagram": "@usuario ou null",
  "followers": "10k ou null",
  "email": "email@x.com ou null",
  "phone": "número ou null",
  "notes": "outras informações relevantes",
  "rawText": "texto completo visível na imagem"
}`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados de lead desta imagem:" },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Image analysis failed:", response.status, errText);
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    
    console.log("✅ Image analyzed:", content.substring(0, 200));
    
    // Parse JSON from response
    try {
      const jsonStr = content.replace(/```json?\n?|\n?```/g, "").trim();
      return JSON.parse(jsonStr);
    } catch {
      // If not valid JSON, return raw text
      return { rawText: content };
    }
  } catch (error) {
    console.error("❌ Error analyzing image:", error);
    return null;
  }
}

// ============================================================================
// CONVERSATION STATE MANAGEMENT
// ============================================================================

interface ConversationState {
  stage: "idle" | "awaiting_stars" | "awaiting_stage" | "awaiting_followup" | "awaiting_more_data" | "awaiting_confirm_create";
  lead_id?: string;
  lead_name?: string;
  lead_phone?: string;
  lead_instagram?: string;
  lead_email?: string;
  lead_notes?: string;
  last_action?: string;
  expires_at: number;
}

// Persist state in database to survive cold starts
async function getState(phone: string): Promise<ConversationState | null> {
  try {
    const { data, error } = await supabase
      .from("whatsapp_assistant_states")
      .select("state, expires_at")
      .eq("phone", phone)
      .maybeSingle();
    
    if (error) {
      console.error("Error fetching state:", error);
      return null;
    }
    
    if (!data) return null;
    
    const expiresAt = new Date(data.expires_at).getTime();
    if (Date.now() > expiresAt) {
      // Expired, delete it
      await supabase
        .from("whatsapp_assistant_states")
        .delete()
        .eq("phone", phone);
      return null;
    }
    
    return {
      ...(data.state as ConversationState),
      expires_at: expiresAt,
    };
  } catch (e) {
    console.error("getState error:", e);
    return null;
  }
}

async function setState(phone: string, state: Partial<ConversationState>): Promise<void> {
  try {
    const current = await getState(phone) || { stage: "idle" as const, expires_at: 0 };
    const newState = {
      ...current,
      ...state,
      expires_at: Date.now() + 10 * 60 * 1000, // 10 min TTL
    };
    
    const expiresAt = new Date(newState.expires_at).toISOString();
    
    await supabase
      .from("whatsapp_assistant_states")
      .upsert({
        phone,
        state: newState,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "phone" });
    
    console.log("💾 State saved for", phone, "stage:", newState.stage);
  } catch (e) {
    console.error("setState error:", e);
  }
}

async function clearState(phone: string): Promise<void> {
  try {
    await supabase
      .from("whatsapp_assistant_states")
      .delete()
      .eq("phone", phone);
    console.log("🗑️ State cleared for", phone);
  } catch (e) {
    console.error("clearState error:", e);
  }
}

// ============================================================================
// STAR RATING DESCRIPTIONS
// ============================================================================

function getStarDescription(stars: number): string {
  switch (stars) {
    case 1: return "⭐ 1 estrela = Lead frio, baixo potencial";
    case 2: return "⭐⭐ 2 estrelas = Algum interesse, acompanhar";
    case 3: return "⭐⭐⭐ 3 estrelas = Potencial médio, trabalhar";
    case 4: return "⭐⭐⭐⭐ 4 estrelas = Muito interessado, priorizar";
    case 5: return "⭐⭐⭐⭐⭐ 5 estrelas = CLIENTE TOP! Fechar agora!";
    default: return "";
  }
}

function getAllStarDescriptions(): string {
  return `*Quantas estrelas esse lead merece?*

${getStarDescription(1)}
${getStarDescription(2)}
${getStarDescription(3)}
${getStarDescription(4)}
${getStarDescription(5)}

Digite de 1 a 5:`;
}

// ============================================================================
// COMMAND TYPES
// ============================================================================

type ParsedCommand =
  | { action: "create_lead"; lead_phone: string; lead_name?: string; stars?: number; cep?: string; notes?: string; instagram?: string; email?: string; }
  | { action: "search_lead"; query: string; }
  | { action: "update_lead"; lead_identifier: string; updates: { 
      stars?: number; 
      status?: string; 
      notes?: string; 
      name?: string; 
      cpf_cnpj?: string;
      favorite_team?: string;
      lead_source?: string;
      instagram?: string;
      email?: string;
      birth_date?: string;
      gender?: string;
      city?: string;
      state?: string;
    }; }
  | { action: "list_leads"; filter?: string; stars?: number; limit?: number; }
  | { action: "schedule_followup"; lead_identifier: string; date?: string; time?: string; notes?: string; }
  | { action: "create_meeting"; lead_identifier: string; date: string; time?: string; link?: string; notes?: string; }
  | { action: "change_stage"; lead_identifier: string; stage: string; }
  | { action: "help"; }
  | { action: "stats"; }
  | { action: "quick_star"; stars: number; }
  | { action: "quick_stage"; stage: string; }
  | { action: "quick_followup"; option: string; }
  | { action: "skip_step"; }
  | { action: "unknown"; reply?: string; };

// ============================================================================
// AI COMMAND PARSER
// ============================================================================

async function parseCommandWithAI(text: string, hasActiveState: boolean, contextLeadName?: string): Promise<ParsedCommand | null> {
  if (!LOVABLE_API_KEY) return null;

  const systemPrompt = `Você é a Secretária Morphews, uma assistente de CRM MUITO inteligente.
Analise a mensagem do usuário e retorne APENAS JSON válido (sem markdown, sem \`\`\`).

${hasActiveState && contextLeadName ? `
⚠️ CONTEXTO IMPORTANTE: O usuário está em um fluxo com o lead "${contextLeadName}".
Se o usuário mencionar atualizações sem especificar outro lead, USE "${contextLeadName}" como lead_identifier.
Exemplo: "Esse cliente é gremista" -> {"action":"update_lead","lead_identifier":"${contextLeadName}","updates":{"favorite_team":"Grêmio"}}
` : ""}

${hasActiveState ? `
O USUÁRIO ESTÁ EM UM FLUXO DE CADASTRO. Interprete respostas curtas:
- Números de 1-5 = {"action":"quick_star","stars":X}
- Nome de etapa do funil = {"action":"quick_stage","stage":"..."}
- "1", "2", "3" quando oferecido opções = {"action":"quick_followup","option":"1"}
- "pular", "skip", "não", "depois" = {"action":"skip_step"}
` : ""}

🔥 CAMPOS DO CRM QUE VOCÊ CONHECE:
- stars: Classificação de 1 a 5 estrelas
- cpf_cnpj: CPF ou CNPJ do cliente (documento)
- favorite_team: Time de futebol que o cliente torce (Grêmio, Inter, Flamengo, etc.)
- lead_source: Origem do lead (Instagram, Facebook, Indicação, Caiçara, etc.)
- instagram: @ do Instagram
- email: E-mail do cliente
- birth_date: Data de nascimento (formato YYYY-MM-DD)
- gender: Gênero (masculino/feminino)
- city: Cidade
- state: Estado (RS, SP, RJ, etc.)
- notes: Observações gerais

AÇÕES DISPONÍVEIS:

1. CRIAR LEAD:
{"action":"create_lead","lead_phone":"5551999998888","lead_name":"Nome","stars":5,"notes":"observações"}

2. BUSCAR LEAD (PRIORIZE ESTA AÇÃO para encontrar leads antes de atualizar):
{"action":"search_lead","query":"Maria"}
- Use quando o usuário quer encontrar um lead específico
- O query pode ser nome parcial, telefone ou @instagram

3. ATUALIZAR LEAD (AÇÃO MAIS COMPLETA - todos os campos!):
{"action":"update_lead","lead_identifier":"Maria","updates":{
  "stars": 5,
  "cpf_cnpj": "00315751029",
  "favorite_team": "Grêmio",
  "lead_source": "Instagram",
  "instagram": "@usuario",
  "email": "email@x.com",
  "birth_date": "1990-05-15",
  "gender": "masculino",
  "city": "Porto Alegre",
  "state": "RS",
  "notes": "observação adicional"
}}
- lead_identifier: MUITO FLEXÍVEL - pode ser nome parcial ("Matheus"), nome completo ("Matheus Lopes"), telefone ou @instagram
- updates: Inclua APENAS os campos mencionados pelo usuário

4. LISTAR LEADS:
{"action":"list_leads","filter":"hoje","limit":10}

5. AGENDAR FOLLOWUP:
{"action":"schedule_followup","lead_identifier":"João","date":"2026-01-21","time":"14:00","notes":"ligar"}

6. CRIAR REUNIÃO:
{"action":"create_meeting","lead_identifier":"Dr. Pedro","date":"amanhã","time":"15:00"}

7. MUDAR ETAPA DO FUNIL:
{"action":"change_stage","lead_identifier":"Ana","stage":"reunião agendada"}

8. AJUDA: {"action":"help"}
9. ESTATÍSTICAS: {"action":"stats"}
10. NÃO ENTENDI: {"action":"unknown","reply":"Desculpe, não entendi. Pode reformular?"}

🎯 REGRAS CRÍTICAS:
- CPF/CNPJ são DOCUMENTOS, NUNCA confunda com telefone!
- "cpf é 00315751029" → updates.cpf_cnpj = "00315751029"
- "time/torce/torcedor" → updates.favorite_team
- "origem/veio de/fonte" → updates.lead_source
- Se não encontrar o lead, sugira busca primeiro
- Se o usuário já está em um fluxo com um lead, use esse lead como contexto

💡 EXEMPLOS DE INTERPRETAÇÃO:
"Atualizar Matheus Lopes time grêmio e cpf 00315751029" → 
  {"action":"update_lead","lead_identifier":"Matheus Lopes","updates":{"favorite_team":"Grêmio","cpf_cnpj":"00315751029"}}

"Matheus Lopes origem caiçara" →
  {"action":"update_lead","lead_identifier":"Matheus Lopes","updates":{"lead_source":"caiçara"}}

"Esse cliente é gremista e cpf é 00315751029" (com contexto de lead) →
  {"action":"update_lead","lead_identifier":"${contextLeadName || "[lead do contexto]"}","updates":{"favorite_team":"Grêmio","cpf_cnpj":"00315751029"}}

"Mudar etapa funil Matheus para Call agendada" →
  {"action":"change_stage","lead_identifier":"Matheus","stage":"Call agendada"}

"Busca Matheus" →
  {"action":"search_lead","query":"Matheus"}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.2,
      }),
    });

    if (!resp.ok) {
      console.error("AI parse error status:", resp.status);
      return null;
    }
    
    const data = await resp.json();
    let content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return null;

    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const parsed = JSON.parse(content);
    if (!parsed?.action) return null;

    return parsed as ParsedCommand;
  } catch (e) {
    console.error("AI parse error:", e);
    return null;
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function findLeadByIdentifier(organizationId: string, identifier: string) {
  const trimmed = (identifier || "").trim();
  if (!trimmed) return null;
  
  const normalized = normalizeWhatsApp(trimmed);
  
  // Try by phone first if looks like a phone
  if (normalized && normalized.length >= 10) {
    const variants = [
      normalized,
      normalized.replace(/^55/, ""),
      normalized.length === 13 ? normalized.slice(0, 4) + normalized.slice(5) : null,
      normalized.length === 12 ? normalized.slice(0, 4) + "9" + normalized.slice(4) : null,
    ].filter(Boolean) as string[];

    for (const v of variants) {
      const { data } = await supabase
        .from("leads")
        .select("id, name, whatsapp, stars, funnel_stage, instagram, email, observations, birth_date, gender, favorite_team, lead_source, cpf_cnpj, city, state, created_at")
        .eq("organization_id", organizationId)
        .or(`whatsapp.ilike.%${v}%,secondary_phone.ilike.%${v}%`)
        .limit(1)
        .maybeSingle();
      if (data) return data;
    }
  }

  // Try EXACT name match first
  const { data: exactName } = await supabase
    .from("leads")
    .select("id, name, whatsapp, stars, funnel_stage, instagram, email, observations, birth_date, gender, favorite_team, lead_source, cpf_cnpj, city, state, created_at")
    .eq("organization_id", organizationId)
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (exactName) return exactName;

  // Try PARTIAL name match (contains)
  const { data: partialName } = await supabase
    .from("leads")
    .select("id, name, whatsapp, stars, funnel_stage, instagram, email, observations, birth_date, gender, favorite_team, lead_source, cpf_cnpj, city, state, created_at")
    .eq("organization_id", organizationId)
    .ilike("name", `%${trimmed}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (partialName) return partialName;

  // Try each word in the identifier (for "Matheus Lopes" -> try "Matheus" then "Lopes")
  const words = trimmed.split(/\s+/).filter(w => w.length >= 3);
  for (const word of words) {
    const { data: byWord } = await supabase
      .from("leads")
      .select("id, name, whatsapp, stars, funnel_stage, instagram, email, observations, birth_date, gender, favorite_team, lead_source, cpf_cnpj, city, state, created_at")
      .eq("organization_id", organizationId)
      .ilike("name", `%${word}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byWord) return byWord;
  }

  // Try by Instagram
  if (trimmed.startsWith("@") || !trimmed.includes(" ")) {
    const instaQuery = trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
    const { data: byInsta } = await supabase
      .from("leads")
      .select("id, name, whatsapp, stars, funnel_stage, instagram, email, observations, birth_date, gender, favorite_team, lead_source, cpf_cnpj, city, state, created_at")
      .eq("organization_id", organizationId)
      .ilike("instagram", `%${instaQuery}%`)
      .limit(1)
      .maybeSingle();
    if (byInsta) return byInsta;
  }

  return null;
}

async function searchLeads(organizationId: string, query: string, limit: number = 5) {
  const normalized = normalizeWhatsApp(query);
  
  let queryBuilder = supabase
    .from("leads")
    .select("id, name, whatsapp, stars, funnel_stage, instagram")
    .eq("organization_id", organizationId)
    .limit(limit);

  if (normalized && normalized.length >= 8) {
    queryBuilder = queryBuilder.or(`whatsapp.ilike.%${normalized}%,whatsapp.ilike.%${query}%`);
  } else {
    queryBuilder = queryBuilder.or(`name.ilike.%${query}%,instagram.ilike.%${query}%,email.ilike.%${query}%`);
  }

  const { data } = await queryBuilder;
  return data || [];
}

async function listLeadsByFilter(organizationId: string, filter?: string, stars?: number, limit: number = 10) {
  let queryBuilder = supabase
    .from("leads")
    .select("id, name, whatsapp, stars, funnel_stage, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (stars) {
    queryBuilder = queryBuilder.eq("stars", stars);
  }

  if (filter === "hoje") {
    const today = new Date().toISOString().split("T")[0];
    queryBuilder = queryBuilder.gte("created_at", today);
  } else if (filter === "semana") {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    queryBuilder = queryBuilder.gte("created_at", weekAgo);
  }

  const { data } = await queryBuilder;
  return data || [];
}

async function getFunnelStages(organizationId: string) {
  const { data } = await supabase
    .from("funnel_stages")
    .select("id, name, position, color")
    .eq("organization_id", organizationId)
    .order("position", { ascending: true });
  return data || [];
}

async function findStageByName(organizationId: string, stageName: string) {
  const stages = await getFunnelStages(organizationId);
  const lower = stageName.toLowerCase();
  
  const stageMap: Record<string, string[]> = {
    "não classificado": ["não classificado", "nao classificado", "novo"],
    "prospectando": ["prospectando", "prospect", "prospecção"],
    "contatado": ["contatado", "contato", "contactado"],
    "convencendo": ["convencendo", "negociando", "negociação"],
    "reunião agendada": ["reunião", "reuniao", "agenda", "call"],
    "positivo": ["positivo", "interessado", "fechou"],
    "aguardando pgto": ["aguardando", "pagamento", "pagar"],
    "sucesso": ["sucesso", "vendido", "fechado", "ganho"],
  };

  for (const stage of stages) {
    const stageLower = stage.name.toLowerCase();
    if (stageLower.includes(lower) || lower.includes(stageLower)) {
      return stage;
    }
    
    for (const [key, aliases] of Object.entries(stageMap)) {
      if (aliases.some(a => lower.includes(a)) && stageLower.includes(key)) {
        return stage;
      }
    }
  }

  return null;
}

async function getNonPurchaseReasons(organizationId: string) {
  const { data } = await supabase
    .from("non_purchase_reasons")
    .select("id, name, is_featured")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("position", { ascending: true })
    .limit(5);
  return data || [];
}

// ============================================================================
// FLOW CONTINUATION BUILDERS
// ============================================================================

function buildStarsPrompt(leadName: string): string {
  return `✅ *${leadName}* cadastrado!

Agora me conta: ${getAllStarDescriptions()}

_(ou digite "pular" para depois)_`;
}

async function buildStagePrompt(organizationId: string, leadName: string): Promise<string> {
  const stages = await getFunnelStages(organizationId);
  const stageList = stages
    .filter(s => !["Cloud", "Trash"].includes(s.name))
    .slice(0, 8)
    .map((s, i) => `${i + 1}. ${s.name}`)
    .join("\n");

  return `⭐ Anotado!

Em qual *etapa do funil* o *${leadName}* está?

${stageList}

_Digite o número ou nome da etapa (ou "pular"):_`;
}

async function buildFollowupPrompt(organizationId: string, leadName: string): Promise<string> {
  const reasons = await getNonPurchaseReasons(organizationId);
  
  let options = "1. Amanhã às 9h\n2. Amanhã às 14h\n3. Em 3 dias";
  
  if (reasons.length > 0) {
    options += "\n\n_Ou agendar por motivo:_\n";
    reasons.slice(0, 3).forEach((r, i) => {
      options += `${i + 4}. ${r.name}\n`;
    });
  }

  return `📍 *${leadName}* atualizado!

Quer que eu agende um *follow-up*? 📅

${options}

_Digite o número da opção (ou "não precisa"):_`;
}

function buildFinalMessage(leadName: string): string {
  return `✅ Tudo certo com *${leadName}*!

🎯 *Como posso te ajudar a vender mais?*

• Cadastrar outro lead
• Buscar algum lead específico
• Ver estatísticas do dia
• Listar leads 5 estrelas

_O que você precisa?_`;
}

function buildMissingDataPrompt(lead: any): string | null {
  const missing: string[] = [];
  
  if (!lead.birth_date) missing.push("📅 Data de nascimento");
  if (!lead.gender) missing.push("👤 Gênero");
  if (!lead.favorite_team) missing.push("⚽ Time que torce");
  if (!lead.instagram) missing.push("📸 Instagram");
  if (!lead.email) missing.push("📧 Email");
  
  if (missing.length === 0) return null;
  
  return `💡 *Dica para vender mais!*

Quanto mais você conhece o lead, mais fácil a venda.
*${lead.name}* ainda não tem:

${missing.join("\n")}

Quer adicionar algum dado agora?
_(Ex: "aniversário dele é 15/03" ou "ele torce pro Grêmio")_

_Ou digite "pular" para continuar:_`;
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

async function handleCreateLead(
  command: Extract<ParsedCommand, { action: "create_lead" }>,
  organizationId: string,
  userId: string,
  fromPhone: string
): Promise<string> {
  const leadPhoneNorm = normalizeWhatsApp(command.lead_phone || "");
  if (!leadPhoneNorm) {
    return "❌ Não encontrei o WhatsApp do lead. Exemplo: Cadastrar lead 51999998888 nome João";
  }

  const existing = await findLeadByIdentifier(organizationId, leadPhoneNorm);
  if (existing) {
    return `✅ Lead já existe: *${existing.name}* (${existing.whatsapp})${existing.stars ? ` ⭐${existing.stars}` : ""}`;
  }

  const leadName = command.lead_name?.trim() || `Lead ${leadPhoneNorm.replace(/^55/, "")}`;
  const stars = command.stars && command.stars >= 1 && command.stars <= 5 ? command.stars : 0;

  const { data: newLead, error } = await supabase
    .from("leads")
    .insert({
      organization_id: organizationId,
      assigned_to: userId,
      name: leadName,
      whatsapp: leadPhoneNorm,
      stars,
      cep: command.cep || null,
      instagram: command.instagram || null,
      email: command.email || null,
      observations: command.notes || null,
    })
    .select("id, name, whatsapp, stars")
    .single();

  if (error) {
    console.error("Lead create error:", error);
    return "❌ Não consegui cadastrar o lead. Tente novamente.";
  }

  // If stars were NOT provided, start the interactive flow
  if (!command.stars || command.stars === 0) {
    await setState(fromPhone, {
      stage: "awaiting_stars",
      lead_id: newLead.id,
      lead_name: newLead.name,
      last_action: "create",
    });
    return buildStarsPrompt(newLead.name);
  }

  // Stars provided - ask for stage
  await setState(fromPhone, {
    stage: "awaiting_stage",
    lead_id: newLead.id,
    lead_name: newLead.name,
    last_action: "create",
  });

  let msg = `✅ *${newLead.name}* cadastrado com ${stars} estrelas!`;
  msg += "\n\n" + await buildStagePrompt(organizationId, newLead.name);
  return msg;
}

async function handleSearchLead(
  command: Extract<ParsedCommand, { action: "search_lead" }>,
  organizationId: string
): Promise<string> {
  const leads = await searchLeads(organizationId, command.query, 5);
  
  if (leads.length === 0) {
    return `🔍 Nenhum lead encontrado para "${command.query}"`;
  }

  let msg = `🔍 *${leads.length} lead(s) encontrado(s):*\n`;
  for (const lead of leads) {
    msg += `\n• *${lead.name}*`;
    if (lead.stars) msg += ` ⭐${lead.stars}`;
    if (lead.whatsapp) msg += `\n  📱 ${lead.whatsapp}`;
    if (lead.funnel_stage) msg += `\n  📍 ${lead.funnel_stage}`;
  }

  return msg;
}

async function handleUpdateLead(
  command: Extract<ParsedCommand, { action: "update_lead" }>,
  organizationId: string,
  contextLeadId?: string
): Promise<string> {
  // Use context lead if identifier matches or is generic
  let lead = null;
  
  if (contextLeadId && command.lead_identifier) {
    // Try to find the lead first
    lead = await findLeadByIdentifier(organizationId, command.lead_identifier);
  } else if (contextLeadId) {
    // Use context lead directly
    const { data } = await supabase
      .from("leads")
      .select("id, name, whatsapp, stars, funnel_stage, instagram, email, observations, birth_date, gender, favorite_team, lead_source, cpf_cnpj, city, state, created_at")
      .eq("id", contextLeadId)
      .maybeSingle();
    lead = data;
  } else {
    lead = await findLeadByIdentifier(organizationId, command.lead_identifier);
  }
  
  if (!lead) {
    // Try a fuzzy search and suggest
    const suggestions = await searchLeads(organizationId, command.lead_identifier, 3);
    if (suggestions.length > 0) {
      let msg = `❌ Lead não encontrado: "${command.lead_identifier}"\n\n🔍 Você quis dizer?\n`;
      suggestions.forEach(s => {
        msg += `• *${s.name}*${s.stars ? ` ⭐${s.stars}` : ""}\n`;
      });
      msg += `\n_Tente: "Atualizar ${suggestions[0].name} ..."_`;
      return msg;
    }
    return `❌ Lead não encontrado: "${command.lead_identifier}"\n\n💡 Tente buscar primeiro: "Busca ${command.lead_identifier}"`;
  }

  const updates: any = {};
  const changes: string[] = [];

  // STARS
  if (command.updates.stars !== undefined) {
    updates.stars = command.updates.stars;
    changes.push(`⭐ ${command.updates.stars} estrelas`);
  }
  
  // CPF/CNPJ
  if (command.updates.cpf_cnpj) {
    const cleanCpf = command.updates.cpf_cnpj.replace(/\D/g, "");
    updates.cpf_cnpj = cleanCpf;
    changes.push(`📄 CPF/CNPJ: ${cleanCpf}`);
  }
  
  // FAVORITE TEAM
  if (command.updates.favorite_team) {
    updates.favorite_team = command.updates.favorite_team;
    changes.push(`⚽ Time: ${command.updates.favorite_team}`);
  }
  
  // LEAD SOURCE (ORIGEM)
  if (command.updates.lead_source) {
    updates.lead_source = command.updates.lead_source;
    changes.push(`📍 Origem: ${command.updates.lead_source}`);
  }
  
  // INSTAGRAM
  if (command.updates.instagram) {
    const insta = command.updates.instagram.startsWith("@") 
      ? command.updates.instagram 
      : `@${command.updates.instagram}`;
    updates.instagram = insta;
    changes.push(`📸 Instagram: ${insta}`);
  }
  
  // EMAIL
  if (command.updates.email) {
    updates.email = command.updates.email;
    changes.push(`📧 Email: ${command.updates.email}`);
  }
  
  // BIRTH DATE
  if (command.updates.birth_date) {
    updates.birth_date = command.updates.birth_date;
    changes.push(`🎂 Nascimento: ${command.updates.birth_date}`);
  }
  
  // GENDER
  if (command.updates.gender) {
    updates.gender = command.updates.gender;
    changes.push(`👤 Gênero: ${command.updates.gender}`);
  }
  
  // CITY
  if (command.updates.city) {
    updates.city = command.updates.city;
    changes.push(`🏙️ Cidade: ${command.updates.city}`);
  }
  
  // STATE
  if (command.updates.state) {
    updates.state = command.updates.state;
    changes.push(`📍 Estado: ${command.updates.state}`);
  }
  
  // NOTES (append)
  if (command.updates.notes) {
    const newNotes = lead.observations 
      ? `${lead.observations}\n\n---\n${new Date().toLocaleString('pt-BR')}: ${command.updates.notes}`
      : command.updates.notes;
    updates.observations = newNotes;
    changes.push(`📝 Nota adicionada`);
  }

  // NAME
  if (command.updates.name) {
    updates.name = command.updates.name;
    changes.push(`✏️ Nome: ${command.updates.name}`);
  }

  if (Object.keys(updates).length === 0) {
    return `ℹ️ Nenhuma atualização para fazer em *${lead.name}*\n\n💡 Campos disponíveis: estrelas, cpf, time, origem, instagram, email, nascimento, gênero, cidade, estado, notas`;
  }

  const { error } = await supabase
    .from("leads")
    .update(updates)
    .eq("id", lead.id);

  if (error) {
    console.error("Lead update error:", error);
    return "❌ Erro ao atualizar o lead. Tente novamente.";
  }

  return `✅ *${lead.name}* atualizado!\n${changes.join("\n")}`;
}

async function handleListLeads(
  command: Extract<ParsedCommand, { action: "list_leads" }>,
  organizationId: string
): Promise<string> {
  const leads = await listLeadsByFilter(
    organizationId, 
    command.filter, 
    command.stars, 
    command.limit || 10
  );
  
  if (leads.length === 0) {
    return "📋 Nenhum lead encontrado com esses filtros.";
  }

  let msg = `📋 *${leads.length} leads:*\n`;
  for (const lead of leads) {
    msg += `\n• *${lead.name}*`;
    if (lead.stars) msg += ` ⭐${lead.stars}`;
    if (lead.funnel_stage) msg += ` | ${lead.funnel_stage}`;
  }

  return msg;
}

async function handleChangeStage(
  command: Extract<ParsedCommand, { action: "change_stage" }>,
  organizationId: string
): Promise<string> {
  const lead = await findLeadByIdentifier(organizationId, command.lead_identifier);
  
  if (!lead) {
    return `❌ Lead não encontrado: "${command.lead_identifier}"`;
  }

  const stage = await findStageByName(organizationId, command.stage);
  
  if (!stage) {
    const stages = await getFunnelStages(organizationId);
    const stageNames = stages.map(s => s.name).join(", ");
    return `❌ Etapa não encontrada: "${command.stage}"\n\nEtapas disponíveis: ${stageNames}`;
  }

  const { error } = await supabase
    .from("leads")
    .update({ funnel_stage: stage.name })
    .eq("id", lead.id);

  if (error) {
    console.error("Stage change error:", error);
    return "❌ Erro ao mudar etapa. Tente novamente.";
  }

  return `✅ *${lead.name}* movido para:\n📍 ${stage.name}`;
}

async function handleScheduleFollowup(
  command: Extract<ParsedCommand, { action: "schedule_followup" }>,
  organizationId: string,
  userId: string
): Promise<string> {
  const lead = await findLeadByIdentifier(organizationId, command.lead_identifier);
  
  if (!lead) {
    return `❌ Lead não encontrado: "${command.lead_identifier}"`;
  }

  let followupDate: Date;
  const dateStr = command.date || "amanhã";
  
  if (dateStr === "amanhã" || dateStr === "amanha") {
    followupDate = new Date();
    followupDate.setDate(followupDate.getDate() + 1);
  } else if (dateStr === "hoje") {
    followupDate = new Date();
  } else {
    followupDate = new Date(dateStr);
  }

  if (command.time) {
    const [hours, minutes] = command.time.split(":").map(Number);
    followupDate.setHours(hours || 9, minutes || 0, 0, 0);
  } else {
    followupDate.setHours(9, 0, 0, 0);
  }

  const { error } = await supabase
    .from("lead_followups")
    .insert({
      organization_id: organizationId,
      lead_id: lead.id,
      user_id: userId,
      scheduled_at: followupDate.toISOString(),
      notes: command.notes || "Follow-up agendado via WhatsApp",
      status: "pending",
    });

  if (error) {
    console.error("Followup create error:", error);
    return "❌ Erro ao agendar follow-up. Tente novamente.";
  }

  const dateFormatted = followupDate.toLocaleDateString('pt-BR');
  const timeFormatted = followupDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return `✅ Follow-up agendado!\n\n👤 *${lead.name}*\n📅 ${dateFormatted} às ${timeFormatted}${command.notes ? `\n📝 ${command.notes}` : ""}`;
}

async function handleCreateMeeting(
  command: Extract<ParsedCommand, { action: "create_meeting" }>,
  organizationId: string,
  userId: string
): Promise<string> {
  const lead = await findLeadByIdentifier(organizationId, command.lead_identifier);
  
  if (!lead) {
    return `❌ Lead não encontrado: "${command.lead_identifier}"`;
  }

  let meetingDate: Date;
  const dateStr = command.date || "amanhã";
  
  if (dateStr === "amanhã" || dateStr === "amanha") {
    meetingDate = new Date();
    meetingDate.setDate(meetingDate.getDate() + 1);
  } else if (dateStr === "hoje") {
    meetingDate = new Date();
  } else {
    meetingDate = new Date(dateStr);
  }

  if (command.time) {
    const [hours, minutes] = command.time.split(":").map(Number);
    meetingDate.setHours(hours || 10, minutes || 0, 0, 0);
  } else {
    meetingDate.setHours(10, 0, 0, 0);
  }

  const meetingNotes = `Reunião: ${meetingDate.toLocaleDateString('pt-BR')} ${command.time || "10:00"}${command.link ? ` - ${command.link}` : ""}`;
  
  const { error } = await supabase
    .from("leads")
    .update({
      meeting_datetime: meetingDate.toISOString(),
      meeting_link: command.link || null,
      funnel_stage: "Reunião Agendada",
      observations: lead.observations 
        ? `${lead.observations}\n\n---\n${meetingNotes}`
        : meetingNotes,
    })
    .eq("id", lead.id);

  if (error) {
    console.error("Meeting create error:", error);
    return "❌ Erro ao agendar reunião. Tente novamente.";
  }

  const dateFormatted = meetingDate.toLocaleDateString('pt-BR');
  const timeFormatted = meetingDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  let msg = `✅ Reunião agendada!\n\n👤 *${lead.name}*\n📅 ${dateFormatted} às ${timeFormatted}`;
  if (command.link) msg += `\n🔗 ${command.link}`;
  msg += `\n📍 Lead movido para "Reunião Agendada"`;

  return msg;
}

async function handleStats(organizationId: string): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { count: todayCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", today);

  const { count: weekCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", weekAgo);

  const { count: fiveStarCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("stars", 5);

  const { count: totalCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  return `📊 *Estatísticas*\n\n📅 Hoje: ${todayCount || 0} leads\n📅 Esta semana: ${weekCount || 0} leads\n⭐ 5 estrelas: ${fiveStarCount || 0}\n📋 Total: ${totalCount || 0} leads\n\n💡 _Quer que eu liste os 5 estrelas?_`;
}

function getHelpMessage(): string {
  return `👋 *Oi! Sou sua Secretária Morphews!*

Meu objetivo é te ajudar a *vender mais*! 💰

📝 *Cadastrar lead:*
"Cadastrar 51999998888 João"

🔍 *Buscar lead:*
"Busca Maria" ou "Procura 51999"

⭐ *Dar estrelas:*
"5 estrelas na Maria"

📍 *Mover no funil:*
"João fechou, coloca como positivo"

📅 *Agendar follow-up:*
"Ligar para Pedro amanhã às 14h"

📊 *Estatísticas:*
"Stats" ou "Estatísticas"

💡 *Dica:* Fala naturalmente! Eu entendo você 😊`;
}

// ============================================================================
// STATE FLOW HANDLERS
// ============================================================================

async function handleQuickStar(
  stars: number,
  state: ConversationState,
  organizationId: string,
  fromPhone: string
): Promise<string> {
  if (!state.lead_id) {
    await clearState(fromPhone);
    return "❌ Perdi o contexto do lead. Pode repetir o cadastro?";
  }

  const validStars = Math.min(5, Math.max(1, stars));
  
  const { error } = await supabase
    .from("leads")
    .update({ stars: validStars })
    .eq("id", state.lead_id);

  if (error) {
    console.error("Star update error:", error);
    return "❌ Erro ao salvar estrelas. Tente novamente.";
  }

  // Move to next step: ask for stage
  await setState(fromPhone, { ...state, stage: "awaiting_stage" });
  
  return await buildStagePrompt(organizationId, state.lead_name || "Lead");
}

async function handleQuickStage(
  stageName: string,
  state: ConversationState,
  organizationId: string,
  fromPhone: string
): Promise<string> {
  if (!state.lead_id) {
    await clearState(fromPhone);
    return "❌ Perdi o contexto do lead. Pode repetir?";
  }

  // Try to find stage by number or name
  const stages = await getFunnelStages(organizationId);
  const filtered = stages.filter(s => !["Cloud", "Trash"].includes(s.name));
  
  let selectedStage = filtered.find(s => s.name.toLowerCase().includes(stageName.toLowerCase()));
  
  // Try by number
  if (!selectedStage) {
    const num = parseInt(stageName);
    if (num >= 1 && num <= filtered.length) {
      selectedStage = filtered[num - 1];
    }
  }

  if (!selectedStage) {
    return `❌ Não encontrei essa etapa. Digite o número (1-${filtered.length}) ou o nome:`;
  }

  const { error } = await supabase
    .from("leads")
    .update({ funnel_stage: selectedStage.name })
    .eq("id", state.lead_id);

  if (error) {
    console.error("Stage update error:", error);
    return "❌ Erro ao atualizar etapa. Tente novamente.";
  }

  // Move to next step: offer followup
  await setState(fromPhone, { ...state, stage: "awaiting_followup" });
  
  return await buildFollowupPrompt(organizationId, state.lead_name || "Lead");
}

async function handleQuickFollowup(
  option: string,
  state: ConversationState,
  organizationId: string,
  userId: string,
  fromPhone: string
): Promise<string> {
  if (!state.lead_id) {
    await clearState(fromPhone);
    return "❌ Perdi o contexto. Pode repetir?";
  }

  const optNum = parseInt(option);
  let followupDate = new Date();
  let notes = "Follow-up via Secretária";

  switch (optNum) {
    case 1:
      followupDate.setDate(followupDate.getDate() + 1);
      followupDate.setHours(9, 0, 0, 0);
      notes = "Amanhã às 9h";
      break;
    case 2:
      followupDate.setDate(followupDate.getDate() + 1);
      followupDate.setHours(14, 0, 0, 0);
      notes = "Amanhã às 14h";
      break;
    case 3:
      followupDate.setDate(followupDate.getDate() + 3);
      followupDate.setHours(9, 0, 0, 0);
      notes = "Em 3 dias";
      break;
    default:
      // Check if it's a non-purchase reason
      const reasons = await getNonPurchaseReasons(organizationId);
      const reasonIdx = optNum - 4;
      if (reasonIdx >= 0 && reasonIdx < reasons.length) {
        notes = reasons[reasonIdx].name;
        followupDate.setDate(followupDate.getDate() + 2);
        followupDate.setHours(10, 0, 0, 0);
      } else {
        // Invalid option, skip
        await clearState(fromPhone);
        return buildFinalMessage(state.lead_name || "Lead");
      }
  }

  const { error } = await supabase
    .from("lead_followups")
    .insert({
      organization_id: organizationId,
      lead_id: state.lead_id,
      user_id: userId,
      scheduled_at: followupDate.toISOString(),
      notes,
      status: "pending",
    });

  if (error) {
    console.error("Followup error:", error);
    await clearState(fromPhone);
    return "❌ Erro ao agendar. Mas o lead foi salvo!\n\n" + buildFinalMessage(state.lead_name || "Lead");
  }

  await clearState(fromPhone);

  const dateFormatted = followupDate.toLocaleDateString('pt-BR');
  const timeFormatted = followupDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return `✅ Follow-up agendado!\n📅 ${dateFormatted} às ${timeFormatted}\n📝 ${notes}\n\n` + buildFinalMessage(state.lead_name || "Lead");
}

async function handleSkipStep(
  state: ConversationState,
  organizationId: string,
  fromPhone: string
): Promise<string> {
  const leadName = state.lead_name || "Lead";

  switch (state.stage) {
    case "awaiting_stars":
      await setState(fromPhone, { ...state, stage: "awaiting_stage" });
      return await buildStagePrompt(organizationId, leadName);
    
    case "awaiting_stage":
      await setState(fromPhone, { ...state, stage: "awaiting_followup" });
      return await buildFollowupPrompt(organizationId, leadName);
    
    case "awaiting_followup":
    case "awaiting_more_data":
    case "awaiting_confirm_create":
    default:
      await clearState(fromPhone);
      return buildFinalMessage(leadName);
  }
}

// ============================================================================
// EXTRACT MESSAGE FROM WEBHOOK PAYLOAD
// ============================================================================

function pickFirstString(...values: any[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

interface IncomingMessage {
  event: string;
  fromPhoneRaw: string;
  text: string;
  isFromMe: boolean;
  hasAudio: boolean;
  hasImage: boolean;
  audioMessage?: {
    base64?: string;
    mimetype?: string;
    url?: string;
  };
  imageMessage?: {
    base64?: string;
    mimetype?: string;
    url?: string;
    caption?: string;
  };
  messageKey?: {
    id: string;
    remoteJid?: string;
    fromMe?: boolean;
  };
  instanceName?: string;
}

function extractIncoming(body: any): IncomingMessage {
  const event = String(body?.event || body?.type || "");
  const data = body?.data || body;
  const key = data?.key || {};
  const message = data?.message || {};
  
  const remoteJid = key?.remoteJid || data?.remoteJid || "";
  const fromPhoneRaw = remoteJid.split("@")[0] || "";
  
  const text = pickFirstString(
    message?.conversation,
    message?.extendedTextMessage?.text,
    message?.text,
    data?.body,
    data?.text
  );
  
  const isFromMe = key?.fromMe === true || data?.fromMe === true;
  
  const audioMsg = message?.audioMessage || message?.pttMessage;
  const imageMsg = message?.imageMessage;
  
  const hasAudio = !!audioMsg;
  const hasImage = !!imageMsg;

  return {
    event,
    fromPhoneRaw,
    text,
    isFromMe,
    hasAudio,
    hasImage,
    audioMessage: hasAudio ? {
      base64: audioMsg?.base64,
      mimetype: audioMsg?.mimetype || "audio/ogg",
      url: audioMsg?.url,
    } : undefined,
    imageMessage: hasImage ? {
      base64: imageMsg?.base64,
      mimetype: imageMsg?.mimetype || "image/jpeg",
      url: imageMsg?.url,
      caption: imageMsg?.caption,
    } : undefined,
    messageKey: key?.id ? {
      id: key.id,
      remoteJid: remoteJid,
      fromMe: isFromMe,
    } : undefined,
    instanceName: data?.instance || body?.instance,
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const incoming = extractIncoming(body);
    const { event, fromPhoneRaw, text, isFromMe, hasAudio, hasImage, audioMessage, imageMessage, messageKey } = incoming;

    console.log("🤖 Secretária Morphews received:", {
      event,
      fromPhoneRaw,
      textPreview: String(text || "").substring(0, 160),
      isFromMe,
      hasAudio,
      hasImage,
      hasMessageKey: !!messageKey,
    });

    const isStatusEvent = ["messages.update", "connection.update", "qrcode.updated"].includes(event);
    if (isStatusEvent || isFromMe) {
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
    // Try both with and without 9th digit to handle phone format variations
    const phoneVariants = getWhatsAppVariants(fromPhone);
    
    console.log("🔍 Looking up profile for phone variants:", phoneVariants);
    
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, organization_id, first_name, whatsapp")
      .in("whatsapp", phoneVariants);

    if (profileError) console.error("Profile lookup error:", profileError);
    
    // Prefer exact match, then any match
    const profile = profiles?.find(p => p.whatsapp === fromPhone) || profiles?.[0];
    
    console.log("📋 Profile found:", profile ? { 
      first_name: profile.first_name, 
      organization_id: profile.organization_id,
      whatsapp: profile.whatsapp 
    } : "none");

    if (!profile?.user_id || !profile?.organization_id) {
      await reply(
        fromPhone,
        "👋 Olá! Não encontrei seu cadastro no Morphews.\n\nPor favor, verifique se seu WhatsApp está cadastrado no seu perfil do CRM."
      );
      return new Response(JSON.stringify({ success: true, unlinked: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = profile.organization_id;
    const userId = profile.user_id;
    const userName = profile.first_name || "você";

    // =========================================================================
    // HANDLE AUDIO - Transcribe and process as text command
    // =========================================================================
    if (hasAudio) {
      await reply(fromPhone, "🎤 Recebi seu áudio! Transcrevendo...");
      
      let base64 = audioMessage?.base64;
      let mimeType = audioMessage?.mimetype || "audio/ogg";
      
      // If no base64 in payload, download from Evolution API
      if (!base64 && messageKey) {
        const media = await downloadMediaFromEvolution(messageKey);
        if (media) {
          base64 = media.base64;
          mimeType = media.mimeType;
        }
      }
      
      if (!base64) {
        await reply(fromPhone, "❌ Não consegui acessar o áudio. Pode tentar enviar de novo?");
        return new Response(JSON.stringify({ success: true, audio_error: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const transcription = await transcribeAudioWithGroq(base64, mimeType);
      
      if (!transcription) {
        await reply(fromPhone, "❌ Não consegui transcrever o áudio. Pode tentar de novo ou mandar por texto?");
        return new Response(JSON.stringify({ success: true, transcription_error: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Show transcription and process as command
      await reply(fromPhone, `📝 Entendi: "${transcription}"\n\nProcessando...`);
      
      // Process transcription as a command
      const state = await getState(fromPhone);
      const hasActiveState = !!state && state.stage !== "idle";
      const parsed = await parseCommandWithAI(transcription, hasActiveState, state?.lead_name);
      
      if (!parsed) {
        await reply(fromPhone, "🤔 Não entendi o que você disse. Pode repetir de outra forma?");
        return new Response(JSON.stringify({ success: true, parse_error: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      let response: string;
      if (hasActiveState && state) {
        switch (parsed.action) {
          case "quick_star":
            response = await handleQuickStar(parsed.stars, state, organizationId, fromPhone);
            break;
          case "quick_stage":
            response = await handleQuickStage(parsed.stage, state, organizationId, fromPhone);
            break;
          case "quick_followup":
            response = await handleQuickFollowup(parsed.option, state, organizationId, userId, fromPhone);
            break;
          case "skip_step":
            response = await handleSkipStep(state, organizationId, fromPhone);
            break;
          default:
            await clearState(fromPhone);
            response = await handleCommand(parsed, organizationId, userId, fromPhone, userName);
        }
      } else {
        response = await handleCommand(parsed, organizationId, userId, fromPhone, userName);
      }
      
      await reply(fromPhone, response);
      return new Response(JSON.stringify({ success: true, action: "audio_processed", parsed: parsed.action }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // HANDLE IMAGE - Analyze and extract lead data
    // =========================================================================
    if (hasImage) {
      await reply(fromPhone, "📸 Recebi sua imagem! Analisando...");
      
      let base64 = imageMessage?.base64;
      let mimeType = imageMessage?.mimetype || "image/jpeg";
      const caption = imageMessage?.caption || "";
      
      // If no base64 in payload, download from Evolution API
      if (!base64 && messageKey) {
        const media = await downloadMediaFromEvolution(messageKey);
        if (media) {
          base64 = media.base64;
          mimeType = media.mimeType;
        }
      }
      
      if (!base64) {
        await reply(fromPhone, "❌ Não consegui acessar a imagem. Pode tentar enviar de novo?");
        return new Response(JSON.stringify({ success: true, image_error: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const analysis = await analyzeImageWithAI(base64, mimeType);
      
      if (!analysis) {
        await reply(fromPhone, "❌ Não consegui analisar a imagem. Pode tentar de novo?");
        return new Response(JSON.stringify({ success: true, analysis_error: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Build response based on extracted data
      let resultMsg = "📋 *Dados extraídos da imagem:*\n\n";
      
      if (analysis.leadName) resultMsg += `👤 *Nome:* ${analysis.leadName}\n`;
      if (analysis.instagram) resultMsg += `📸 *Instagram:* ${analysis.instagram}\n`;
      if (analysis.followers) resultMsg += `👥 *Seguidores:* ${analysis.followers}\n`;
      if (analysis.email) resultMsg += `📧 *Email:* ${analysis.email}\n`;
      if (analysis.phone) resultMsg += `📱 *Telefone:* ${analysis.phone}\n`;
      if (analysis.notes) resultMsg += `📝 *Info:* ${analysis.notes}\n`;
      
      // If we found enough data, offer to create lead
      if (analysis.leadName || analysis.instagram) {
        const leadName = analysis.leadName || (analysis.instagram ? analysis.instagram.replace("@", "") : "Lead da imagem");
        const leadPhone = analysis.phone ? normalizeWhatsApp(analysis.phone) : "";
        
        resultMsg += "\n🎯 *Quer que eu cadastre este lead?*\n";
        resultMsg += `Digite: "sim" para cadastrar${leadPhone ? "" : " (preciso de um WhatsApp)"}\n`;
        resultMsg += `Ou: "cadastrar ${leadName} ${leadPhone || "[WhatsApp]"}"`;
        
        // Store ALL extracted data for potential follow-up
        await setState(fromPhone, {
          stage: "awaiting_confirm_create",
          lead_name: leadName,
          lead_phone: leadPhone,
          lead_instagram: analysis.instagram || undefined,
          lead_email: analysis.email || undefined,
          lead_notes: analysis.notes || undefined,
          last_action: "image_extracted",
        });
      } else {
        resultMsg += "\n_Não encontrei dados suficientes. Me conta mais sobre esse lead!_";
      }
      
      await reply(fromPhone, resultMsg);
      return new Response(JSON.stringify({ success: true, action: "image_analyzed", data: analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawText = String(text || "").trim();
    if (!rawText) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for active conversation state
    const state = await getState(fromPhone);
    const hasActiveState = !!state && state.stage !== "idle";

    // =========================================================================
    // HANDLE CONFIRMATION RESPONSES (sim/yes/não/no) WITH CONTEXT
    // =========================================================================
    const lowerText = rawText.toLowerCase().trim();
    const isConfirmation = ["sim", "yes", "s", "ok", "pode", "cadastra", "quero", "bora"].includes(lowerText);
    const isDenial = ["não", "nao", "no", "n", "cancel", "cancela", "deixa"].includes(lowerText);
    
    // If user confirms and we have pending data from image extraction
    if (isConfirmation && state?.stage === "awaiting_confirm_create" && state.lead_name) {
      console.log("📸 Confirming lead creation from image:", state);
      
      if (!state.lead_phone) {
        await reply(fromPhone, `❌ Preciso do WhatsApp do lead para cadastrar.\n\nDigite: "cadastrar ${state.lead_name} [número do WhatsApp]"`);
        return new Response(JSON.stringify({ success: true, action: "need_phone" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Create the lead with all extracted data
      const { data: newLead, error } = await supabase
        .from("leads")
        .insert({
          organization_id: organizationId,
          assigned_to: userId,
          name: state.lead_name,
          whatsapp: state.lead_phone,
          instagram: state.lead_instagram || null,
          email: state.lead_email || null,
          observations: state.lead_notes || null,
          stars: 0,
        })
        .select("id, name, whatsapp, stars")
        .single();
      
      if (error) {
        console.error("Lead create error:", error);
        await clearState(fromPhone);
        await reply(fromPhone, "❌ Não consegui cadastrar o lead. Tente novamente.");
        return new Response(JSON.stringify({ success: true, action: "create_error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Move to stars flow
      await setState(fromPhone, {
        stage: "awaiting_stars",
        lead_id: newLead.id,
        lead_name: newLead.name,
        last_action: "create",
      });
      
      await reply(fromPhone, buildStarsPrompt(newLead.name));
      return new Response(JSON.stringify({ success: true, action: "lead_created_from_image", lead_id: newLead.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // If user denies
    if (isDenial && state?.stage === "awaiting_confirm_create") {
      await clearState(fromPhone);
      await reply(fromPhone, "👍 Ok, cancelado!\n\nO que mais posso fazer por você?");
      return new Response(JSON.stringify({ success: true, action: "cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse command with AI (tell AI if we have active state for context)
    const contextLeadName = state?.lead_name;
    const parsed = await parseCommandWithAI(rawText, hasActiveState, contextLeadName);
    
    if (!parsed) {
      await reply(fromPhone, "🤔 Desculpe, tive um problema. Pode tentar de novo?");
      return new Response(JSON.stringify({ success: true, action: "parse_error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("📋 Parsed command:", parsed, "State:", state?.stage);

    let response: string;

    // Handle state-based responses first
    if (hasActiveState && state) {
      switch (parsed.action) {
        case "quick_star":
          response = await handleQuickStar(parsed.stars, state, organizationId, fromPhone);
          break;
        
        case "quick_stage":
          response = await handleQuickStage(parsed.stage, state, organizationId, fromPhone);
          break;
        
        case "quick_followup":
          response = await handleQuickFollowup(parsed.option, state, organizationId, userId, fromPhone);
          break;
        
        case "skip_step":
          response = await handleSkipStep(state, organizationId, fromPhone);
          break;
        
        default:
          // User wants to do something else - pass context lead for update commands
          const ctxLeadId = state.lead_id;
          await clearState(fromPhone);
          response = await handleCommand(parsed, organizationId, userId, fromPhone, userName, ctxLeadId);
      }
    } else {
      response = await handleCommand(parsed, organizationId, userId, fromPhone, userName);
    }

    await reply(fromPhone, response);

    return new Response(JSON.stringify({ success: true, action: parsed.action }), {
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

// Helper to handle standard commands
async function handleCommand(
  parsed: ParsedCommand,
  organizationId: string,
  userId: string,
  fromPhone: string,
  userName: string,
  contextLeadId?: string
): Promise<string> {
  switch (parsed.action) {
    case "create_lead":
      return await handleCreateLead(parsed, organizationId, userId, fromPhone);
    
    case "search_lead":
      return await handleSearchLead(parsed, organizationId);
    
    case "update_lead":
      return await handleUpdateLead(parsed, organizationId, contextLeadId);
    
    case "list_leads":
      return await handleListLeads(parsed, organizationId);
    
    case "change_stage":
      return await handleChangeStage(parsed, organizationId);
    
    case "schedule_followup":
      return await handleScheduleFollowup(parsed, organizationId, userId);
    
    case "create_meeting":
      return await handleCreateMeeting(parsed, organizationId, userId);
    
    case "stats":
      return await handleStats(organizationId);
    
    case "help":
      return getHelpMessage();
    
    case "unknown":
    default:
      if (parsed.action === "unknown" && parsed.reply) {
        return parsed.reply;
      }
      return `Oi ${userName}! 👋\n\n${getHelpMessage()}`;
  }
}
