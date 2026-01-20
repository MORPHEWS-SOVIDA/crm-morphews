import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeWhatsApp(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";
  if (!clean.startsWith("55")) clean = `55${clean}`;
  if (clean.length === 12 && clean.startsWith("55")) {
    clean = clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
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

  // Remove trailing slash from URL
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
// COMMAND TYPES - Expanded for full CRM functionality
// ============================================================================

type ParsedCommand =
  | { action: "create_lead"; lead_phone: string; lead_name?: string; stars?: number; cep?: string; notes?: string; instagram?: string; email?: string; }
  | { action: "search_lead"; query: string; }
  | { action: "update_lead"; lead_identifier: string; updates: { stars?: number; status?: string; notes?: string; name?: string; }; }
  | { action: "list_leads"; filter?: string; stars?: number; limit?: number; }
  | { action: "schedule_followup"; lead_identifier: string; date?: string; time?: string; notes?: string; }
  | { action: "create_meeting"; lead_identifier: string; date: string; time?: string; link?: string; notes?: string; }
  | { action: "change_stage"; lead_identifier: string; stage: string; }
  | { action: "help"; }
  | { action: "stats"; }
  | { action: "unknown"; reply?: string; };

// ============================================================================
// AI COMMAND PARSER - Full CRM understanding
// ============================================================================

async function parseCommandWithAI(text: string, conversationHistory: string[] = []): Promise<ParsedCommand | null> {
  if (!LOVABLE_API_KEY) return null;

  const systemPrompt = `Você é a Secretária Morphews, uma assistente de CRM inteligente.
Analise a mensagem do usuário e retorne APENAS JSON válido (sem markdown, sem \`\`\`).

AÇÕES DISPONÍVEIS:

1. CRIAR LEAD:
{"action":"create_lead","lead_phone":"5551999998888","lead_name":"Nome","stars":5,"notes":"observações","instagram":"@user","email":"email@x.com"}

2. BUSCAR LEAD (por nome, telefone ou parte):
{"action":"search_lead","query":"Maria"}
{"action":"search_lead","query":"51999"}

3. ATUALIZAR LEAD (estrelas, status, notas):
{"action":"update_lead","lead_identifier":"Maria","updates":{"stars":5}}
{"action":"update_lead","lead_identifier":"51999","updates":{"notes":"Adicionou interesse"}}

4. LISTAR LEADS:
{"action":"list_leads","filter":"hoje","limit":10}
{"action":"list_leads","stars":5}

5. AGENDAR FOLLOWUP:
{"action":"schedule_followup","lead_identifier":"João","date":"2026-01-21","time":"14:00","notes":"ligar para confirmar"}

6. CRIAR REUNIÃO:
{"action":"create_meeting","lead_identifier":"Dr. Pedro","date":"amanhã","time":"15:00","link":"https://meet.google.com/xxx"}

7. MUDAR ETAPA DO FUNIL:
{"action":"change_stage","lead_identifier":"Ana","stage":"reunião agendada"}
{"action":"change_stage","lead_identifier":"Pedro","stage":"positivo"}

8. AJUDA:
{"action":"help"}

9. ESTATÍSTICAS:
{"action":"stats"}

10. NÃO ENTENDI:
{"action":"unknown","reply":"Desculpe, não entendi. Você pode cadastrar leads, buscar, atualizar estrelas, agendar reuniões..."}

REGRAS:
- lead_identifier pode ser nome parcial, telefone ou @instagram
- stars: 1 a 5
- stage pode ser: "não classificado", "prospectando", "contatado", "convencendo", "reunião agendada", "positivo", "aguardando pgto", "sucesso"
- Interprete linguagem natural! Ex: "coloca 5 estrelas na Maria" = update_lead
- "busca" ou "procura" = search_lead
- "lista" ou "mostra" = list_leads
- "cadastra" ou "adiciona" = create_lead
- Mensagem de áudio transcrita ou descrição de imagem também deve ser interpretada

EXEMPLOS DE ENTRADA -> SAÍDA:
"Cadastrar lead 51999908088 nome Guilherme 5 estrelas" -> create_lead
"Busca a Dra. Maria" -> search_lead
"Coloca 5 estrelas no João" -> update_lead
"Lista todos os 5 estrelas" -> list_leads
"Marca reunião com Pedro amanhã às 15h" -> create_meeting
"O Dr. Pedro fechou, coloca como positivo" -> change_stage
"Acabei de sair de reunião com Ana, muito interessada, 4 estrelas" -> update_lead (estrelas + notas)
"Oi" -> unknown com saudação`;

  const messages: any[] = [
    { role: "system", content: systemPrompt },
  ];
  
  // Add conversation history for context
  for (const msg of conversationHistory.slice(-5)) {
    messages.push({ role: "user", content: msg });
  }
  
  messages.push({ role: "user", content: text });

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      console.error("AI parse error status:", resp.status);
      return null;
    }
    
    const data = await resp.json();
    let content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return null;

    // Clean markdown if present
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
  const normalized = normalizeWhatsApp(identifier);
  
  // Try by phone variations
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
        .select("id, name, whatsapp, stars, funnel_stage, instagram, email, observations, created_at")
        .eq("organization_id", organizationId)
        .or(`whatsapp.ilike.%${v}%,secondary_phone.ilike.%${v}%`)
        .limit(1)
        .maybeSingle();
      if (data) return data;
    }
  }

  // Try by name (partial match)
  const { data: byName } = await supabase
    .from("leads")
    .select("id, name, whatsapp, stars, funnel_stage, instagram, email, observations, created_at")
    .eq("organization_id", organizationId)
    .ilike("name", `%${identifier}%`)
    .limit(1)
    .maybeSingle();
  if (byName) return byName;

  // Try by Instagram
  if (identifier.startsWith("@")) {
    const { data: byInsta } = await supabase
      .from("leads")
      .select("id, name, whatsapp, stars, funnel_stage, instagram, email, observations, created_at")
      .eq("organization_id", organizationId)
      .ilike("instagram", `%${identifier}%`)
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
    .select("id, name, position")
    .eq("organization_id", organizationId)
    .order("position", { ascending: true });
  return data || [];
}

async function findStageByName(organizationId: string, stageName: string) {
  const stages = await getFunnelStages(organizationId);
  const lower = stageName.toLowerCase();
  
  // Map common names to stage names
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
    
    // Check mapped names
    for (const [key, aliases] of Object.entries(stageMap)) {
      if (aliases.some(a => lower.includes(a)) && stageLower.includes(key)) {
        return stage;
      }
    }
  }

  return null;
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

async function handleCreateLead(
  command: Extract<ParsedCommand, { action: "create_lead" }>,
  organizationId: string,
  userId: string
): Promise<string> {
  const leadPhoneNorm = normalizeWhatsApp(command.lead_phone || "");
  if (!leadPhoneNorm) {
    return "❌ Não encontrei o WhatsApp do lead. Exemplo: Cadastrar lead 51999998888 nome João";
  }

  // Check for existing
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

  let msg = `✅ Lead cadastrado!\n\n📋 *${newLead.name}*\n📱 ${newLead.whatsapp}`;
  if (stars) msg += `\n⭐ ${stars} estrelas`;
  if (command.instagram) msg += `\n📸 ${command.instagram}`;
  
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
  organizationId: string
): Promise<string> {
  const lead = await findLeadByIdentifier(organizationId, command.lead_identifier);
  
  if (!lead) {
    return `❌ Lead não encontrado: "${command.lead_identifier}"`;
  }

  const updates: any = {};
  const changes: string[] = [];

  if (command.updates.stars !== undefined) {
    updates.stars = command.updates.stars;
    changes.push(`⭐ ${command.updates.stars} estrelas`);
  }
  
  if (command.updates.notes) {
    const newNotes = lead.observations 
      ? `${lead.observations}\n\n---\n${new Date().toLocaleString('pt-BR')}: ${command.updates.notes}`
      : command.updates.notes;
    updates.observations = newNotes;
    changes.push(`📝 Nota adicionada`);
  }

  if (command.updates.name) {
    updates.name = command.updates.name;
    changes.push(`✏️ Nome: ${command.updates.name}`);
  }

  if (Object.keys(updates).length === 0) {
    return `ℹ️ Nenhuma atualização para fazer em *${lead.name}*`;
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

  // Parse date
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
      scheduled_date: followupDate.toISOString(),
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

  // Parse date
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

  // Update lead with meeting info
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

  // Count leads today
  const { count: todayCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", today);

  // Count leads this week
  const { count: weekCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", weekAgo);

  // Count 5-star leads
  const { count: fiveStarCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("stars", 5);

  // Count total leads
  const { count: totalCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  return `📊 *Estatísticas*\n\n📅 Hoje: ${todayCount || 0} leads\n📅 Esta semana: ${weekCount || 0} leads\n⭐ 5 estrelas: ${fiveStarCount || 0}\n📋 Total: ${totalCount || 0} leads`;
}

function getHelpMessage(): string {
  return `👋 *Oi! Sou sua Secretária Morphews!*

Posso te ajudar a gerenciar seus leads pelo WhatsApp:

📝 *Cadastrar lead:*
"Cadastrar lead 51999998888 nome João 5 estrelas"

🔍 *Buscar lead:*
"Busca a Dra. Maria"
"Procura lead 51999"

⭐ *Atualizar estrelas:*
"Coloca 5 estrelas no João"
"Atualiza Maria com 4 estrelas"

📋 *Listar leads:*
"Lista meus leads 5 estrelas"
"Mostra leads de hoje"

📅 *Agendar reunião:*
"Marca reunião com Pedro amanhã às 15h"

📍 *Mudar etapa do funil:*
"Coloca o João como positivo"
"Move Maria para reunião agendada"

📊 *Ver estatísticas:*
"Estatísticas" ou "Stats"

💡 *Dica:* Fale naturalmente! Eu entendo linguagem humana 😊`;
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

function extractIncoming(body: any): { 
  event: string; 
  fromPhoneRaw: string; 
  text: string; 
  isFromMe: boolean;
  hasAudio: boolean;
  hasImage: boolean;
  mediaBase64?: string;
  mediaMimeType?: string;
} {
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
  
  // Check for audio
  const hasAudio = !!(message?.audioMessage || message?.pttMessage);
  
  // Check for image
  const hasImage = !!(message?.imageMessage);
  
  // Get media base64 if available
  const mediaBase64 = message?.audioMessage?.base64 || 
                      message?.pttMessage?.base64 || 
                      message?.imageMessage?.base64 ||
                      data?.base64;
  
  const mediaMimeType = message?.audioMessage?.mimetype ||
                        message?.pttMessage?.mimetype ||
                        message?.imageMessage?.mimetype;

  return { event, fromPhoneRaw, text, isFromMe, hasAudio, hasImage, mediaBase64, mediaMimeType };
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

    const { event, fromPhoneRaw, text, isFromMe, hasAudio, hasImage } = extractIncoming(body);

    console.log("🤖 Secretária Morphews received:", {
      event,
      fromPhoneRaw,
      textPreview: String(text || "").substring(0, 160),
      isFromMe,
      hasAudio,
      hasImage,
    });

    // Ignore status events
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
        "👋 Olá! Não encontrei seu cadastro no Morphews.\n\nPor favor, verifique se seu WhatsApp está cadastrado corretamente no seu perfil do CRM ou entre em contato com o suporte."
      );
      return new Response(JSON.stringify({ success: true, unlinked: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = profile.organization_id;
    const userId = profile.user_id;
    const userName = profile.first_name || "você";

    // Handle audio/image (inform user to use text for now)
    if (hasAudio) {
      await reply(fromPhone, "🎤 Recebi seu áudio! Em breve vou poder transcrever áudios automaticamente. Por enquanto, me manda por texto o que você precisa! 😊");
      return new Response(JSON.stringify({ success: true, pending_audio: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (hasImage) {
      await reply(fromPhone, "📸 Recebi sua imagem! Em breve vou poder extrair dados de prints do Instagram automaticamente. Por enquanto, me conta o que você quer cadastrar! 😊");
      return new Response(JSON.stringify({ success: true, pending_image: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawText = String(text || "").trim();
    if (!rawText) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse command with AI
    const parsed = await parseCommandWithAI(rawText);
    
    if (!parsed) {
      await reply(fromPhone, "🤔 Desculpe, tive um problema para entender. Pode tentar de novo?");
      return new Response(JSON.stringify({ success: true, action: "parse_error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("📋 Parsed command:", parsed);

    // Handle each action type
    let response: string;

    switch (parsed.action) {
      case "create_lead":
        response = await handleCreateLead(parsed, organizationId, userId);
        break;
      
      case "search_lead":
        response = await handleSearchLead(parsed, organizationId);
        break;
      
      case "update_lead":
        response = await handleUpdateLead(parsed, organizationId);
        break;
      
      case "list_leads":
        response = await handleListLeads(parsed, organizationId);
        break;
      
      case "change_stage":
        response = await handleChangeStage(parsed, organizationId);
        break;
      
      case "schedule_followup":
        response = await handleScheduleFollowup(parsed, organizationId, userId);
        break;
      
      case "create_meeting":
        response = await handleCreateMeeting(parsed, organizationId, userId);
        break;
      
      case "stats":
        response = await handleStats(organizationId);
        break;
      
      case "help":
        response = getHelpMessage();
        break;
      
      case "unknown":
      default:
        if (parsed.action === "unknown" && parsed.reply) {
          response = parsed.reply;
        } else {
          response = `Oi ${userName}! 👋 ${getHelpMessage()}`;
        }
        break;
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
