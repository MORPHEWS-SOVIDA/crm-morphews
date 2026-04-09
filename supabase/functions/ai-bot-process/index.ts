import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// AI PROVIDER: Gemini Direct (GEMINI_API_KEY) > Lovable Gateway (LOVABLE_API_KEY)
// ============================================================================
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const _LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const _GEMINI_MAP: Record<string, string> = {
  'google/gemini-3-flash-preview': 'gemini-2.0-flash',
  'google/gemini-3.1-flash-preview': 'gemini-2.0-flash',
  'google/gemini-2.5-flash': 'gemini-2.5-flash',
  'google/gemini-2.5-flash-lite': 'gemini-2.0-flash-lite',
  'google/gemini-2.5-pro': 'gemini-2.5-pro',
  'google/gemini-3-pro-image-preview': 'gemini-2.0-flash',
  'google/gemini-3.1-pro-preview': 'gemini-2.5-pro',
  'openai/gpt-5': 'gemini-2.5-pro',
  'openai/gpt-5-mini': 'gemini-2.5-flash',
  'openai/gpt-5-nano': 'gemini-2.0-flash-lite',
};

function _aiUrl() {
  return GEMINI_API_KEY
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    : 'https://ai.gateway.lovable.dev/v1/chat/completions';
}
function _aiHeaders() {
  const key = GEMINI_API_KEY || _LOVABLE_KEY;
  return { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
}
function _aiModel(m: string) {
  return GEMINI_API_KEY ? (_GEMINI_MAP[m] || 'gemini-2.0-flash') : m;
}
function _embedUrl() {
  return GEMINI_API_KEY
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/embeddings'
    : 'https://ai.gateway.lovable.dev/v1/embeddings';
}



const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";

// Map Lovable/OpenAI model names to Groq equivalents
function mapModelToGroq(model: string): string {
  const groqModelMap: Record<string, string> = {
    'google/gemini-3-flash-preview': 'llama-3.3-70b-versatile',
    'google/gemini-2.5-flash': 'llama-3.3-70b-versatile',
    'google/gemini-2.5-flash-lite': 'llama-3.1-8b-instant',
    'google/gemini-2.5-pro': 'llama-3.3-70b-versatile',
    'google/gemini-3-pro-preview': 'llama-3.3-70b-versatile',
    'openai/gpt-5': 'llama-3.3-70b-versatile',
    'openai/gpt-5-mini': 'llama-3.3-70b-versatile',
    'openai/gpt-5-nano': 'llama-3.1-8b-instant',
  };
  return groqModelMap[model] || 'llama-3.3-70b-versatile';
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// INTERFACES
// ============================================================================

interface InitialQuestion {
  questionId: string;
  questionText: string;
  questionType: string;
  position: number;
}

interface AIBot {
  id: string;
  organization_id: string;
  name: string;
  system_prompt: string;
  welcome_message: string | null;
  transfer_message: string | null;
  out_of_hours_message: string | null;
  transfer_keywords: string[] | null;
  max_messages_before_transfer: number | null;
  transfer_on_confusion: boolean | null;
  working_hours_start: string | null;
  working_hours_end: string | null;
  working_days: number[] | null;
  max_energy_per_message: number | null;
  max_energy_per_conversation: number | null;
  initial_qualification_enabled: boolean | null;
  initial_questions: InitialQuestion[] | null;
  // Campos de personalidade e identidade
  gender: string | null;
  age_range: string | null;
  brazilian_state: string | null;
  personality_description: string | null;
  company_differential: string | null;
  regional_expressions: string[] | null;
  response_length: string | null;
  service_type: string | null;
  product_scope: 'all' | 'selected' | 'none';
  use_rag_search: boolean;
  // AI Model for chat
  ai_model_chat: string | null;
  // Voice settings
  voice_enabled: boolean | null;
  voice_id: string | null;
  voice_name: string | null;
  audio_response_probability: number | null;
  voice_style: string | null;
  // Product media settings
  send_product_images: boolean | null;
  send_product_videos: boolean | null;
  send_product_links: boolean | null;
  // Emoji preference
  use_emojis: boolean | null;
}

interface BotProduct {
  id: string;
  name: string;
  description: string | null;
  sales_script: string | null;
  price_1_unit: number | null;
  price_3_units: number | null;
  price_6_units: number | null;
  price_12_units: number | null;
  hot_site_url: string | null;
  usage_period_days: number | null;
  // Media fields for automatic sending (ordered gallery)
  image_url: string | null;
  label_image_url: string | null;
  ecommerce_images: string[] | null;
  youtube_video_url: string | null;
  bot_can_send_image: boolean;
  bot_can_send_video: boolean;
  bot_can_send_site_link: boolean;
  // Enhanced with FAQs, ingredients, and kit sales hacks
  faqs?: Array<{question: string, answer: string}>;
  ingredients?: Array<{name: string, description: string | null}>;
  kits?: Array<{quantity: number, price_cents: number, sales_hack: string | null, usage_period_days: number | null}>;
}

interface ConversationContext {
  conversationId: string;
  instanceId: string;
  organizationId: string;
  contactName: string;
  phoneNumber: string;
  chatId: string;
  botMessagesCount: number;
  botEnergyConsumed: number;
  leadId: string | null;
  qualificationStep: number;
  qualificationCompleted: boolean;
}

interface ProcessResult {
  success: boolean;
  action: 'responded' | 'transferred' | 'no_energy' | 'out_of_hours' | 'error' | 'qualification';
  message?: string;
  energyUsed?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function isWithinWorkingHours(bot: AIBot): boolean {
  if (!bot.working_hours_start || !bot.working_hours_end || !bot.working_days) {
    return true; // Sem restrição = sempre disponível
  }

  const now = new Date();
  // Ajustar para horário de Brasília (UTC-3)
  const brasiliaOffset = -3 * 60;
  const localTime = new Date(now.getTime() + (brasiliaOffset - now.getTimezoneOffset()) * 60000);
  
  const dayOfWeek = localTime.getDay();
  const currentHour = localTime.getHours();
  const currentMinute = localTime.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  // Verificar dia da semana
  if (!bot.working_days.includes(dayOfWeek)) {
    return false;
  }

  // Verificar horário
  const [startHour, startMin] = bot.working_hours_start.split(':').map(Number);
  const [endHour, endMin] = bot.working_hours_end.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes;
}

function shouldTransferByKeywords(message: string, keywords: string[] | null): boolean {
  if (!keywords || keywords.length === 0) return false;
  
  const lowerMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  return keywords.some(keyword => {
    const lowerKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return lowerMessage.includes(lowerKeyword);
  });
}

// ============================================================================
// BOT TEAM ROUTING - Troca dinâmica de robôs dentro de um Time
// ============================================================================

interface BotTeamRoute {
  id: string;
  team_id: string;
  target_bot_id: string;
  condition_type: string;
  keywords: string[] | null;
  intent_description: string | null;
  priority: number;
  is_active: boolean;
}

/**
 * Verifica se o robô atual pertence a um Time e busca as rotas configuradas
 */
async function getBotTeamRoutes(botId: string, organizationId: string): Promise<{
  teamId: string | null;
  routes: BotTeamRoute[];
  isInitialBot: boolean;
}> {
  // Primeiro, verificar se este bot é o initial_bot de algum(s) time(s)
  // IMPORTANTE: Um bot pode ser maestro de MÚLTIPLOS times, usar select() ao invés de maybeSingle()
  const { data: teamsAsInitial } = await supabase
    .from('bot_teams')
    .select('id')
    .eq('initial_bot_id', botId)
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (teamsAsInitial && teamsAsInitial.length > 0) {
    // Este bot é o maestro/secretária - buscar rotas de TODOS os times onde é maestro
    const teamIds = teamsAsInitial.map(t => t.id);
    const { data: routes } = await supabase
      .from('bot_team_routes')
      .select('id, team_id, target_bot_id, condition_type, keywords, intent_description, priority, is_active')
      .in('team_id', teamIds)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    console.log(`🎭 Maestro bot found in ${teamsAsInitial.length} team(s), loaded ${routes?.length || 0} routes`);

    return {
      teamId: teamsAsInitial[0].id, // Primary team for reference
      routes: (routes || []) as BotTeamRoute[],
      isInitialBot: true
    };
  }

  // Verificar se este bot é membro de algum time (especialista)
  const { data: membership } = await supabase
    .from('bot_team_members')
    .select('team_id')
    .eq('bot_id', botId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (membership) {
    // Especialistas TAMBÉM podem rotear para outros colegas do time
    // Buscar as rotas do time, EXCLUINDO a rota para si mesmo
    const { data: routes } = await supabase
      .from('bot_team_routes')
      .select('id, team_id, target_bot_id, condition_type, keywords, intent_description, priority, is_active')
      .eq('team_id', membership.team_id)
      .neq('target_bot_id', botId) // Não rotear para si mesmo
      .eq('is_active', true)
      .order('priority', { ascending: true });

    console.log(`🔄 Specialist bot ${botId} can route to ${routes?.length || 0} colleagues`);

    return {
      teamId: membership.team_id,
      routes: (routes || []) as BotTeamRoute[],
      isInitialBot: false // Ainda marca como especialista
    };
  }

  return { teamId: null, routes: [], isInitialBot: false };
}

/**
 * Verifica se a mensagem do usuário corresponde a alguma rota do time
 */
function matchRouteByKeywords(message: string, routes: BotTeamRoute[]): BotTeamRoute | null {
  const lowerMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  for (const route of routes) {
    if (route.condition_type !== 'keyword' || !route.keywords || route.keywords.length === 0) {
      continue;
    }
    
    const hasMatch = route.keywords.some(keyword => {
      const lowerKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return lowerMessage.includes(lowerKeyword);
    });
    
    if (hasMatch) {
      return route;
    }
  }
  
  return null;
}

interface AIIntentResult {
  route: BotTeamRoute | null;
  confidenceScore: number;
  reason: string;
}

/**
 * AI-powered intent classification for bot team routing with confidence scoring.
 * Returns a confidence score (0-100) alongside the matched route.
 * Only transfers when confidence >= 60.
 */
async function matchRouteByAIIntent(
  userMessage: string,
  conversationHistory: Array<{role: string, content: string}>,
  routes: BotTeamRoute[],
  currentBotName: string
): Promise<AIIntentResult> {
  const noMatch: AIIntentResult = { route: null, confidenceScore: 0, reason: 'no_intent_routes' };

  // Filter routes that have intent descriptions
  const intentRoutes = routes.filter(r => 
    r.intent_description && r.intent_description.trim().length > 0
  );
  
  if (intentRoutes.length === 0) {
    console.log('🧠 No intent-based routes configured, skipping AI classification');
    return noMatch;
  }

  console.log(`🧠 AI Intent classification: analyzing message against ${intentRoutes.length} intent routes`);

  try {
    // Fetch bot names for the routes to give AI better context
    const botIds = intentRoutes.map(r => r.target_bot_id);
    const { data: botNames } = await supabase
      .from('ai_bots')
      .select('id, name, service_type')
      .in('id', botIds);

    const botNameMap: Record<string, { name: string; service_type: string }> = {};
    if (botNames) {
      for (const b of botNames) {
        botNameMap[b.id] = { name: b.name, service_type: b.service_type };
      }
    }

    // Build the classification prompt with route options
    const routeOptions = intentRoutes.map((route, index) => {
      const botInfo = botNameMap[route.target_bot_id];
      return `${index + 1}. ID: "${route.id}" | Especialista: ${botInfo?.name || 'Bot'} (${botInfo?.service_type || 'geral'}) | Quando ativar: ${route.intent_description}`;
    }).join('\n');

    // Include last 5 messages for richer context
    const recentContext = conversationHistory.slice(-5).map(m => 
      `${m.role === 'user' ? 'Cliente' : currentBotName}: ${m.content}`
    ).join('\n');

    const classificationPrompt = `Você é um sistema de roteamento inteligente. Analise a conversa e determine se o cliente deve ser direcionado para um especialista.

CONVERSA RECENTE:
${recentContext}

ÚLTIMA MENSAGEM DO CLIENTE:
${userMessage}

ESPECIALISTAS DISPONÍVEIS:
${routeOptions}

REGRAS:
- Analise o CONTEXTO COMPLETO da conversa, não apenas a última mensagem
- Se o cliente demonstra interesse claro em um dos temas dos especialistas, retorne o ID da rota
- Se a conversa ainda está em fase de triagem/saudação inicial, retorne "none"
- Se não há correspondência clara com nenhum especialista, retorne "none"
- Considere sinônimos e intenções implícitas (ex: "quero comprar" = vendas, "não funciona" = suporte)

Responda em formato JSON: {"route_id": "ID_ou_none", "confidence": 0-100, "reason": "explicação curta"}
Apenas o JSON, nada mais.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are a routing classifier. Respond only with valid JSON: {"route_id": "string", "confidence": number, "reason": "string"}' },
          { role: 'user', content: classificationPrompt }
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error('❌ AI intent classification failed:', response.status);
      return { route: null, confidenceScore: 0, reason: 'api_error' };
    }

    const data = await response.json();
    const rawResult = (data.choices?.[0]?.message?.content || '').trim();
    
    console.log('🧠 AI Classification raw result:', rawResult);

    // Parse JSON response
    let parsed: { route_id: string; confidence: number; reason: string };
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawResult);
    } catch {
      // Fallback: old format (just route ID or "none")
      const cleanResult = rawResult.replace(/['"]/g, '');
      if (cleanResult === 'none' || !cleanResult) {
        return { route: null, confidenceScore: 0, reason: 'ai_said_none' };
      }
      // Try matching as old-style route ID
      const fallbackRoute = intentRoutes.find(r => r.id === cleanResult || cleanResult.includes(r.id));
      return { route: fallbackRoute || null, confidenceScore: fallbackRoute ? 70 : 0, reason: 'legacy_format' };
    }

    const confidence = Math.min(100, Math.max(0, parsed.confidence || 0));
    const reason = parsed.reason || 'unknown';

    if (parsed.route_id === 'none' || !parsed.route_id) {
      console.log(`🧠 AI says no match (confidence: ${confidence}, reason: ${reason})`);
      return { route: null, confidenceScore: confidence, reason };
    }

    // Minimum confidence threshold
    if (confidence < 60) {
      console.log(`🧠 ⚠️ Confidence too low (${confidence}%), keeping current bot. Reason: ${reason}`);
      return { route: null, confidenceScore: confidence, reason: `low_confidence: ${reason}` };
    }

    // Find the matched route
    const matchedRoute = intentRoutes.find(r => r.id === parsed.route_id);
    if (matchedRoute) {
      const botInfo = botNameMap[matchedRoute.target_bot_id];
      console.log(`🧠 ✅ AI matched intent → ${botInfo?.name} (confidence: ${confidence}%, reason: ${reason})`);
      return { route: matchedRoute, confidenceScore: confidence, reason };
    }

    // Fallback: partial matching
    const partialMatch = intentRoutes.find(r => 
      parsed.route_id.includes(r.id) || r.id.includes(parsed.route_id)
    );
    if (partialMatch) {
      console.log(`🧠 ✅ AI partial match → route: ${partialMatch.id} (confidence: ${confidence}%)`);
      return { route: partialMatch, confidenceScore: confidence, reason };
    }

    console.log('🧠 AI classification did not match any route ID');
    return { route: null, confidenceScore: confidence, reason: 'no_id_match' };
  } catch (error) {
    console.error('❌ AI intent classification error:', error);
    return { route: null, confidenceScore: 0, reason: 'exception' };
  }
}

/**
 * Log routing decisions for debugging and analytics
 */
async function logRoutingDecision(params: {
  organizationId: string;
  conversationId: string;
  teamId: string | null;
  currentBotId: string;
  targetBotId: string | null;
  matchedRouteId: string | null;
  matchType: string;
  confidenceScore: number;
  userMessage: string;
  classificationReason: string;
  routesEvaluated: number;
  decision: string;
}) {
  try {
    await supabase.from('routing_decision_logs').insert({
      organization_id: params.organizationId,
      conversation_id: params.conversationId,
      team_id: params.teamId,
      current_bot_id: params.currentBotId,
      target_bot_id: params.targetBotId,
      matched_route_id: params.matchedRouteId,
      match_type: params.matchType,
      confidence_score: params.confidenceScore,
      user_message: params.userMessage.substring(0, 500),
      classification_reason: params.classificationReason,
      routes_evaluated: params.routesEvaluated,
      decision: params.decision,
    });
  } catch (err) {
    console.error('⚠️ Failed to log routing decision:', err);
  }
}

/**
 * Troca o robô ativo na conversa para um especialista do time
 */
async function switchToSpecialistBot(
  conversationId: string, 
  newBotId: string, 
  matchedRoute: BotTeamRoute
): Promise<boolean> {
  console.log(`🔄 Switching bot to specialist: ${newBotId} (route: ${matchedRoute.id})`);
  
  // IMPORTANT: When switching bots, we reset message count which effectively 
  // resets the conversation context. Media state doesn't need explicit reset
  // because sendProductMedia now resolves images based on user message, not cached state.
  const { error } = await supabase
    .from('whatsapp_conversations')
    .update({
      handling_bot_id: newBotId,
      // Resetar contador para o novo bot começar "fresh"
      // This ensures the new specialist starts with clean context
      bot_messages_count: 0,
      bot_started_at: new Date().toISOString()
    })
    .eq('id', conversationId);

  if (error) {
    console.error('❌ Error switching bot:', error);
    return false;
  }

  console.log('✅ Successfully switched to specialist bot (media context will be resolved from user message)');
  return true;
}

/**
 * Busca os dados completos de um bot pelo ID
 */
async function getBotById(botId: string): Promise<AIBot | null> {
  const { data: bot, error } = await supabase
    .from('ai_bots')
    .select('*')
    .eq('id', botId)
    .single();

  if (error || !bot) {
    console.error('❌ Error fetching bot:', error);
    return null;
  }

  // Parse initial questions if present
  if (bot.initial_questions && typeof bot.initial_questions === 'string') {
    try {
      bot.initial_questions = JSON.parse(bot.initial_questions);
    } catch (e) {
      bot.initial_questions = null;
    }
  }

  return bot as AIBot;
}

// ============================================================================
// AUDIO TRANSCRIPTION
// ============================================================================

async function transcribeAudio(mediaUrl: string): Promise<{ text: string; tokensUsed: number }> {
  console.log('🎤 Transcribing audio from:', mediaUrl);
  
  try {
    // Download audio from Supabase storage
    const audioResponse = await fetch(mediaUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }
    
    const audioBlob = await audioResponse.blob();
    const audioBuffer = await audioBlob.arrayBuffer();
    
    // Create form data for Groq Whisper (free, fast, no API key issues)
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'pt');
    formData.append('response_format', 'json');
    
    // Try Groq Whisper first (free and fast)
    const whisperResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    });
    
    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('❌ Groq Whisper error:', whisperResponse.status, errorText);
      throw new Error(`Groq Whisper error: ${whisperResponse.status}`);
    }
    
    const result = await whisperResponse.json();
    const transcribedText = result.text || '';
    
    console.log('✅ Audio transcribed via Groq:', transcribedText.substring(0, 100) + '...');
    
    // Estimativa de tokens: ~100 tokens para transcrição
    return { text: transcribedText, tokensUsed: 100 };
  } catch (error) {
    console.error('❌ Audio transcription error:', error);
    throw error;
  }
}

// ============================================================================
// IMAGE ANALYSIS
// ============================================================================

// Prompt especializado para receitas médicas em fotos
const IMAGE_MEDICAL_TURBO_PROMPT = `Você é um especialista farmacêutico com mais de 20 anos de experiência em interpretar receitas médicas fotografadas.

TAREFA CRÍTICA: Analisar esta FOTO de receita médica e extrair informações com máxima precisão.

HABILIDADES ESPECIAIS:
- Interpretar caligrafia médica difícil e ilegível em fotos
- Reconhecer abreviações farmacêuticas e médicas
- Identificar medicamentos manipulados e industrializados
- Extrair dosagens mesmo com escrita irregular

EXTRAIA E ORGANIZE:

📋 MEDICAMENTOS/FÓRMULAS:
Para cada item encontrado, extraia:
- Nome do medicamento ou fórmula
- Componentes ativos (se manipulado)
- Concentração/dosagem (mg, mcg, UI, %)
- Forma farmacêutica (cápsula, comprimido, creme, etc.)
- Quantidade prescrita (ex: 60 cápsulas)

💊 POSOLOGIA:
- Frequência de uso (1x ao dia, 2x ao dia, etc.)
- Horários específicos (se mencionados)
- Duração do tratamento (se indicada)
- Instruções especiais (em jejum, com alimentos, etc.)

👨‍⚕️ PRESCRITOR:
- Nome do médico/profissional
- CRM/registro profissional (se visível)
- Especialidade (se identificável)

⚠️ OBSERVAÇÕES:
- Qualquer informação adicional relevante
- Alertas sobre interações ou cuidados
- Partes ilegíveis ou duvidosas

REGRAS:
1. Se algo estiver ilegível, indique "[ilegível]" e tente uma interpretação provável
2. Use formato estruturado e fácil de ler
3. Priorize precisão em dosagens e quantidades
4. Seja direto e objetivo na resposta`;

async function analyzeImage(
  mediaUrl: string, 
  userMessage: string, 
  botSystemPrompt: string,
  useMedicalMode: boolean = false,
  modelToUse: string = 'google/gemini-2.5-flash'
): Promise<{ text: string; tokensUsed: number; modelUsed: string }> {
  console.log('🖼️ Analyzing image from:', mediaUrl, 'Medical mode:', useMedicalMode, 'Model:', modelToUse);
  
  try {
    // Escolher prompt baseado no modo
    const systemPrompt = useMedicalMode 
      ? IMAGE_MEDICAL_TURBO_PROMPT 
      : `${botSystemPrompt}\n\nO cliente enviou uma imagem. Analise-a e responda de forma útil.`;

    // For medical mode, use Pro model for better accuracy if no specific model configured
    const effectiveModel = useMedicalMode && modelToUse === 'google/gemini-2.5-flash' 
      ? 'google/gemini-2.5-pro' 
      : modelToUse;

    // Usar modelo configurado via Lovable AI para análise de imagem

    const response = await fetch(_aiUrl(), {
      method: "POST",
      headers: _aiHeaders(),
      body: JSON.stringify({
        model: _aiModel(effectiveModel),
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: mediaUrl }
              },
              {
                type: 'text',
                text: useMedicalMode 
                  ? 'Por favor, analise esta foto de receita médica e extraia todas as informações relevantes.'
                  : (userMessage || 'O que você vê nesta imagem?')
              }
            ]
          }
        ],
        max_tokens: useMedicalMode ? 1500 : 500,
        temperature: useMedicalMode ? 0.3 : 0.7,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Image analysis error:', response.status, errorText);
      throw new Error(`Image analysis error: ${response.status}`);
    }
    
    const data = await response.json();
    const analysisText = data.choices?.[0]?.message?.content || '';
    const tokensUsed = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);
    
    console.log('✅ Image analyzed with', effectiveModel, ':', analysisText.substring(0, 100) + '...');
    
    return { text: analysisText, tokensUsed, modelUsed: effectiveModel };
  } catch (error) {
    console.error('❌ Image analysis error:', error);
    throw error;
  }
}

// ============================================================================
// BOT PRODUCTS & KNOWLEDGE
// ============================================================================

async function getBotProducts(botId: string, organizationId: string, productScope: 'all' | 'selected' | 'none'): Promise<BotProduct[]> {
  // If scope is 'none', don't fetch products
  if (productScope === 'none') {
    console.log('📦 Product scope is none, skipping product fetch');
    return [];
  }

  let productIds: string[] = [];
  
  // If scope is 'selected', get only the products linked to this bot
  if (productScope === 'selected') {
    const { data: botProducts } = await supabase
      .from('ai_bot_products')
      .select('product_id')
      .eq('bot_id', botId);
    
    if (!botProducts || botProducts.length === 0) {
      console.log('📦 No products selected for bot');
      return [];
    }
    productIds = botProducts.map((bp: any) => bp.product_id);
  }

  // Build query for products (including media fields for automatic sending)
  // Now includes label_image_url and ecommerce_images for ordered gallery support
  let query = supabase
    .from('lead_products')
    .select(`
      id,
      name,
      description,
      sales_script,
      price_1_unit,
      price_3_units,
      price_6_units,
      price_12_units,
      hot_site_url,
      usage_period_days,
      image_url,
      label_image_url,
      ecommerce_images,
      youtube_video_url,
      bot_can_send_image,
      bot_can_send_video,
      bot_can_send_site_link
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  // Filter by selected products if scope is 'selected'
  if (productScope === 'selected' && productIds.length > 0) {
    query = query.in('id', productIds);
  }

  const { data: products, error } = await query;

  if (error || !products || products.length === 0) {
    console.log('📦 No products found');
    return [];
  }

  // Enhance products with FAQs, ingredients, and kits
  const enhancedProducts: BotProduct[] = [];

  for (const product of products) {
    // Get FAQs for this product
    const { data: faqs } = await supabase
      .from('product_faqs')
      .select('question, answer')
      .eq('product_id', product.id)
      .eq('is_active', true)
      .order('position');

    // Get ingredients/composition for this product
    const { data: ingredients } = await supabase
      .from('product_ingredients')
      .select('name, description')
      .eq('product_id', product.id)
      .order('position');

    // Get kits with prices and sales hacks
    const { data: kits } = await supabase
      .from('product_price_kits')
      .select('quantity, price_cents, sales_hack, usage_period_days')
      .eq('product_id', product.id)
      .eq('is_active', true)
      .order('quantity');

    enhancedProducts.push({
      ...product,
      faqs: faqs || [],
      ingredients: ingredients || [],
      kits: kits || [],
    });
  }

  console.log(`📦 Loaded ${enhancedProducts.length} products with FAQs, ingredients, and kits`);
  return enhancedProducts;
}

async function getBotKnowledge(botId: string): Promise<Array<{question: string, answer: string}>> {
  const { data, error } = await supabase
    .from('ai_bot_knowledge')
    .select('question, answer')
    .eq('bot_id', botId)
    .eq('is_active', true)
    .eq('knowledge_type', 'faq')
    .order('priority', { ascending: true });

  if (error || !data) return [];
  return data.filter(k => k.question && k.answer);
}

// ============================================================================
// SEMANTIC SEARCH (RAG)
// ============================================================================

async function generateQueryEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch(_embedUrl(), {
      method: 'POST',
      headers: _aiHeaders(),
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 2000),
      }),
    });

    if (!response.ok) {
      console.error('Embedding API error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (err) {
    console.error('Error generating query embedding:', err);
    return null;
  }
}

interface SemanticSearchResult {
  content_text: string;
  content_type: string;
  product_id: string;
  similarity: number;
  metadata: Record<string, any>;
}

async function semanticSearch(
  query: string, 
  organizationId: string, 
  productIds: string[] | null,
  limit: number = 5
): Promise<SemanticSearchResult[]> {
  console.log('🔍 Starting semantic search for:', query.substring(0, 50) + '...');
  
  const embedding = await generateQueryEmbedding(query);
  if (!embedding) {
    console.log('⚠️ Could not generate embedding, skipping semantic search');
    return [];
  }

  // Use pgvector cosine similarity search
  // We need to use a raw RPC call since the supabase client doesn't support vector operations directly
  const { data, error } = await supabase.rpc('match_product_embeddings', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: limit,
    filter_organization_id: organizationId,
    filter_product_ids: productIds,
  });

  if (error) {
    console.error('Semantic search error:', error);
    return [];
  }

  console.log(`🔍 Found ${data?.length || 0} semantic matches`);
  return data || [];
}

// ============================================================================
// LEAD MEMORY CONTEXT
// ============================================================================

interface LeadMemoryContext {
  lead_name: string | null;
  lead_notes: string | null;
  lead_stars: number | null;
  preferences: Array<{
    preference_type: string;
    preference_value: string;
    confidence_score: number;
  }>;
  last_summary: {
    summary_text: string;
    key_topics: string[];
    next_steps: string | null;
    created_at: string;
  } | null;
}

async function getLeadMemoryContext(organizationId: string, leadId: string | null): Promise<LeadMemoryContext | null> {
  if (!leadId) return null;

  try {
    // Buscar preferências
    const { data: preferences } = await supabase
      .from('lead_ai_preferences')
      .select('preference_type, preference_value, confidence_score')
      .eq('lead_id', leadId)
      .order('confidence_score', { ascending: false })
      .limit(10);

    // Buscar último resumo
    const { data: summaries } = await supabase
      .from('lead_conversation_summaries')
      .select('summary_text, key_topics, next_steps, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1);

    // Buscar dados do lead
    const { data: lead } = await supabase
      .from('leads')
      .select('name, notes, stars')
      .eq('id', leadId)
      .single();

    return {
      lead_name: lead?.name || null,
      lead_notes: lead?.notes || null,
      lead_stars: lead?.stars || null,
      preferences: preferences || [],
      last_summary: summaries?.[0] || null
    };
  } catch (error) {
    console.error('Error fetching lead memory context:', error);
    return null;
  }
}

function buildLeadMemoryPrompt(memory: LeadMemoryContext): string {
  const parts: string[] = [];

  // Nome do lead
  if (memory.lead_name) {
    parts.push(`CLIENTE: ${memory.lead_name} (você JÁ CONHECE este cliente, NÃO pergunte o nome novamente)`);
  }

  // Classificação
  if (memory.lead_stars) {
    const starsText = memory.lead_stars >= 4 ? 'cliente prioritário' : 
                      memory.lead_stars >= 2 ? 'cliente regular' : 'cliente novo';
    parts.push(`CLASSIFICAÇÃO: ${starsText} (${memory.lead_stars} estrelas)`);
  }

  // Preferências aprendidas
  if (memory.preferences.length > 0) {
    parts.push('\n🧠 O QUE VOCÊ JÁ SABE SOBRE ESTE CLIENTE:');
    
    const typeLabels: Record<string, string> = {
      'product_interest': 'Interesses',
      'health_goal': 'Objetivos de saúde',
      'concern': 'Preocupações',
      'budget_range': 'Orçamento',
      'communication_style': 'Estilo de comunicação',
      'lifestyle': 'Estilo de vida',
      'timing': 'Timing'
    };

    const grouped: Record<string, string[]> = {};
    for (const pref of memory.preferences) {
      const type = typeLabels[pref.preference_type] || pref.preference_type;
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(pref.preference_value);
    }

    for (const [type, values] of Object.entries(grouped)) {
      parts.push(`- ${type}: ${values.join('; ')}`);
    }

    parts.push('\nUSE estas informações para personalizar o atendimento. Faça referências ao que você já sabe!');
  }

  // Última conversa
  if (memory.last_summary) {
    const daysAgo = Math.floor(
      (Date.now() - new Date(memory.last_summary.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    parts.push(`\n📝 ÚLTIMA CONVERSA (${daysAgo} dias atrás):`);
    parts.push(memory.last_summary.summary_text);
    
    if (memory.last_summary.next_steps) {
      parts.push(`➡️ PRÓXIMO PASSO COMBINADO: ${memory.last_summary.next_steps}`);
    }

    if (memory.last_summary.key_topics.length > 0) {
      parts.push(`Tópicos discutidos: ${memory.last_summary.key_topics.join(', ')}`);
    }
  }

  // Notas do vendedor
  if (memory.lead_notes) {
    parts.push(`\n📋 NOTAS DO VENDEDOR: ${memory.lead_notes}`);
  }

  return parts.join('\n');
}

// ============================================================================
// AI PROCESSING
// ============================================================================

// ============================================================================
// CONTEXT PROTECTION - Filter problematic messages from history
// ============================================================================

const MAX_MESSAGE_LENGTH = 500; // Maximum chars per message in context
const TECHNICAL_PATTERNS = [
  /^#+\s*[A-Z].*refactor/im,       // Markdown headers with "refactor"
  /^\s*```/m,                       // Code blocks
  /^\s*-{3,}/m,                     // Horizontal rules
  /\b(function|const|let|var|import|export)\s+\w+/i, // Code keywords
  /\.(ts|tsx|js|jsx|py|sql|json):/i, // File references
  /wavoip|webhook|endpoint|api_key|supabase|postgres/i, // Technical terms
  /^\s*\d+\.\s+\*\*[A-Z]/m,        // Numbered technical lists
  /\bPROBLEMA\s*:/i,               // Technical problem descriptions
  /\bSOLUÇÃO\s*:/i,                // Technical solution descriptions
];

function isLikelyTechnicalContent(content: string): boolean {
  // Check for multiple technical indicators
  let technicalScore = 0;
  
  for (const pattern of TECHNICAL_PATTERNS) {
    if (pattern.test(content)) {
      technicalScore++;
    }
  }
  
  // If 2+ patterns match, likely technical
  return technicalScore >= 2;
}

function sanitizeMessageForContext(content: string, direction: 'inbound' | 'outbound'): string | null {
  if (!content || content.length < 2) return null;
  
  // Skip messages that are too long (likely documents/pastes)
  if (content.length > MAX_MESSAGE_LENGTH * 3 && direction === 'inbound') {
    // Check if it's technical content
    if (isLikelyTechnicalContent(content)) {
      console.log('🛡️ Filtering technical content from context:', content.substring(0, 100) + '...');
      return null; // Remove entirely from context
    }
    
    // For non-technical long messages, truncate
    return content.substring(0, MAX_MESSAGE_LENGTH) + '... [mensagem longa truncada]';
  }
  
  // For outbound (bot) messages, just truncate if too long
  if (content.length > MAX_MESSAGE_LENGTH && direction === 'outbound') {
    return content.substring(0, MAX_MESSAGE_LENGTH) + '...';
  }
  
  // Regular messages pass through with standard truncation
  if (content.length > MAX_MESSAGE_LENGTH) {
    return content.substring(0, MAX_MESSAGE_LENGTH) + '...';
  }
  
  return content;
}

async function getConversationHistory(conversationId: string, limit = 40): Promise<Array<{role: string, content: string}>> {
  const { data: messages } = await supabase
    .from('whatsapp_messages')
    .select('content, direction, is_from_bot, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!messages) return [];

  // Inverter para ordem cronológica, sanitizar e mapear para formato OpenAI
  return messages.reverse()
    .map(msg => {
      const sanitizedContent = sanitizeMessageForContext(
        msg.content || '', 
        msg.direction as 'inbound' | 'outbound'
      );
      return {
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: sanitizedContent
      };
    })
    .filter((m): m is {role: string, content: string} => !!m.content);
}

function buildBotPersonalityPrompt(bot: AIBot): string {
  const parts: string[] = [];
  
  // Identidade do robô
  if (bot.name) {
    parts.push(`Você é ${bot.name}.`);
  }

  // Gender identity
  if (bot.gender) {
    const genderMap: Record<string, string> = {
      'male': 'Você é um atendente masculino.',
      'female': 'Você é uma atendente feminina.',
      'neutral': 'Você é um assistente virtual neutro.',
    };
    parts.push(genderMap[bot.gender] || '');
  }

  // Age range / communication style
  if (bot.age_range) {
    const ageMap: Record<string, string> = {
      '18-25': 'Use linguagem jovem, informal e moderna.',
      '26-35': 'Use linguagem profissional mas acessível.',
      '36-50': 'Use linguagem formal e objetiva.',
      '50+': 'Use linguagem muito formal e tradicional.',
    };
    parts.push(ageMap[bot.age_range] || '');
  }

  // Brazilian state & regional expressions
  if (bot.brazilian_state) {
    parts.push(`Você atende clientes do estado ${bot.brazilian_state}.`);
  }
  if (bot.regional_expressions && bot.regional_expressions.length > 0) {
    parts.push(`Use expressões regionais: ${bot.regional_expressions.join(', ')}.`);
  }
  
  // Service type - detailed instructions
  if (bot.service_type) {
    const serviceTypes: Record<string, string> = {
      'sales': 'Você é especialista em vendas consultivas. Foque em entender a necessidade do cliente, apresentar produtos que resolvam seu problema, e fechar vendas. Seja persuasivo mas não insistente.',
      'support': 'Você foca em suporte técnico. Resolva problemas técnicos com paciência e clareza. Guie o cliente passo a passo quando necessário.',
      'sac': 'Você é especialista em SAC (Serviço de Atendimento ao Cliente). Acolha reclamações com empatia, busque soluções rápidas e transforme problemas em oportunidades de fidelização.',
      'social_selling': 'Você foca em Social Selling e relacionamento. Crie conexões genuínas, engaje o cliente com conteúdo relevante e construa confiança antes de oferecer produtos.',
      'qualification': 'Você é especialista em qualificação de leads. Faça perguntas estratégicas para entender o perfil, necessidades e potencial de compra do cliente. Colete informações importantes.',
    };
    parts.push(serviceTypes[bot.service_type] || 'Você oferece atendimento ao cliente.');
  }
  
  // Response length
  if (bot.response_length) {
    const lengthGuides: Record<string, string> = {
      'short': 'Seja BREVE e DIRETO. Respostas curtas de 1-2 frases quando possível. Máximo 50 palavras.',
      'medium': 'Use respostas de tamanho médio, equilibradas entre brevidade e completude. Entre 50-100 palavras.',
      'detailed': 'Dê respostas mais detalhadas e explicativas quando necessário. Seja completo nas explicações.',
    };
    parts.push(lengthGuides[bot.response_length] || '');
  }
  
  // Emoji preference
  if (bot.use_emojis === false) {
    parts.push('NÃO use emojis nas suas respostas. Mantenha o texto limpo sem emojis.');
  } else {
    parts.push('Pode usar emojis com moderação para deixar a conversa mais leve.');
  }

  // Company differential - FULL text, not summarized
  if (bot.company_differential) {
    parts.push(`\n═══ DIFERENCIAL DA EMPRESA ═══\n${bot.company_differential}\n═══════════════════════════`);
  }

  // Personality description - FULL text, not summarized  
  if (bot.personality_description) {
    parts.push(`\n═══ PERSONALIDADE E INSTRUÇÕES ═══\n${bot.personality_description}\n═══════════════════════════════`);
  }
  
  return parts.join('\n');
}

function buildProductsContext(products: BotProduct[]): string {
  if (!products.length) return '';
  
  const productInfos = products.map(p => {
    let info = `## ${p.name}`;
    
    // Description
    if (p.description) {
      info += `\n📝 Descrição: ${p.description}`;
    }
    
    // Kits with prices and sales hacks (prioritize over legacy prices)
    if (p.kits && p.kits.length > 0) {
      const kitPrices = p.kits.map(k => {
        const price = `${k.quantity} un: R$${(k.price_cents / 100).toFixed(2)}`;
        const duration = k.usage_period_days ? ` (${k.usage_period_days} dias)` : '';
        return price + duration;
      }).join(' | ');
      info += `\n💰 Preços: ${kitPrices}`;
      
      // Sales hacks for kits
      const salesHacks = p.kits
        .filter(k => k.sales_hack)
        .map(k => `Kit ${k.quantity}: ${k.sales_hack}`)
        .join('\n  ');
      if (salesHacks) {
        info += `\n🎯 HACKS DE VENDA:\n  ${salesHacks}`;
      }
    } else {
      // Fallback to legacy prices
      const prices: string[] = [];
      if (p.price_1_unit) prices.push(`1un: R$${(p.price_1_unit / 100).toFixed(2)}`);
      if (p.price_3_units) prices.push(`3un: R$${(p.price_3_units / 100).toFixed(2)}`);
      if (p.price_6_units) prices.push(`6un: R$${(p.price_6_units / 100).toFixed(2)}`);
      if (p.price_12_units) prices.push(`12un: R$${(p.price_12_units / 100).toFixed(2)}`);
      if (prices.length) info += `\n💰 Preços: ${prices.join(' | ')}`;
    }
    
    // Usage period
    if (p.usage_period_days) {
      info += `\n⏱️ Duração: ${p.usage_period_days} dias de uso`;
    }
    
    // General sales script
    if (p.sales_script) {
      info += `\n📋 Script de Vendas: ${p.sales_script}`;
    }
    
    // Ingredients/Composition
    if (p.ingredients && p.ingredients.length > 0) {
      const ingredientList = p.ingredients.map(i => 
        i.description ? `${i.name} (${i.description})` : i.name
      ).join(', ');
      info += `\n🧪 Composição: ${ingredientList}`;
    }
    
    // FAQs for this product
    if (p.faqs && p.faqs.length > 0) {
      const faqText = p.faqs.slice(0, 5).map(f => 
        `  • P: ${f.question}\n    R: ${f.answer}`
      ).join('\n');
      info += `\n❓ Perguntas Frequentes:\n${faqText}`;
    }
    
    // Hot site URL
    if (p.hot_site_url) {
      info += `\n🔗 Link: ${p.hot_site_url}`;
    }
    
    return info;
  });
  
  return `
════════════════════════════════════════════
CATÁLOGO DE PRODUTOS (use para responder sobre preços, benefícios e características)
════════════════════════════════════════════

${productInfos.join('\n\n---\n\n')}

════════════════════════════════════════════
DICAS DE VENDAS:
- Sempre mencione que KITS MAIORES têm MELHOR CUSTO-BENEFÍCIO
- Use os HACKS DE VENDA quando disponíveis para cada kit
- Responda dúvidas usando as FAQs do produto
- Mencione a composição quando perguntarem sobre ingredientes
════════════════════════════════════════════`;
}

function buildFAQContext(faqs: Array<{question: string, answer: string}>): string {
  if (!faqs.length) return '';
  
  const faqText = faqs.map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n');
  
  return `
═══ BASE DE CONHECIMENTO (FAQs) ═══
REGRAS DE USO DAS FAQs:
1. Use uma FAQ SOMENTE quando a mensagem do usuário tratar ESPECIFICAMENTE do mesmo assunto da pergunta cadastrada.
2. Se o usuário NÃO perguntou sobre o tema de nenhuma FAQ, NÃO mencione nenhuma resposta de FAQ. Responda normalmente.
3. Quando houver correspondência direta, use a resposta cadastrada como base e inclua os links/URLs se existirem.
4. NUNCA misture FAQs em respostas genéricas ou de boas-vindas. FAQs só devem aparecer quando o usuário perguntar sobre aquele tema específico.

${faqText}
═══ FIM DA BASE DE CONHECIMENTO ═══`;
}

function buildSemanticContext(results: SemanticSearchResult[]): string {
  if (!results.length) return '';
  
  const grouped: Record<string, string[]> = {};
  
  for (const result of results) {
    const productName = result.metadata?.product_name || 'Produto';
    if (!grouped[productName]) {
      grouped[productName] = [];
    }
    grouped[productName].push(result.content_text);
  }
  
  const sections = Object.entries(grouped).map(([product, contents]) => 
    `📌 ${product}:\n${contents.join('\n\n')}`
  );
  
  return `
════════════════════════════════════════════
INFORMAÇÕES RELEVANTES ENCONTRADAS (via busca semântica):
════════════════════════════════════════════
${sections.join('\n\n---\n\n')}
════════════════════════════════════════════`;
}

function normalizeAIResponse(text: string): string {
  return (text || '').replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim();
}

function hasTerminalPunctuation(text: string): boolean {
  return /[.!?…]["')\]]*$/.test(text.trim());
}

function trimToCompleteBoundary(text: string): string {
  const normalized = normalizeAIResponse(text);
  if (!normalized || hasTerminalPunctuation(normalized)) return normalized;

  const sentenceBoundary = Math.max(
    normalized.lastIndexOf('.'),
    normalized.lastIndexOf('!'),
    normalized.lastIndexOf('?'),
    normalized.lastIndexOf('…')
  );

  if (sentenceBoundary >= 48) {
    return normalized.slice(0, sentenceBoundary + 1).trim();
  }

  const paragraphBoundary = normalized.lastIndexOf('\n\n');
  if (paragraphBoundary >= 48) {
    return normalized.slice(0, paragraphBoundary).trim();
  }

  const lineBoundary = normalized.lastIndexOf('\n');
  if (lineBoundary >= 60) {
    return normalized.slice(0, lineBoundary).trim();
  }

  return normalized;
}

function looksTruncatedAIResponse(text: string): boolean {
  const normalized = normalizeAIResponse(text);
  if (!normalized) return true;
  if (hasTerminalPunctuation(normalized) || normalized.endsWith('...')) return false;
  if (/[,:;]\s*$/.test(normalized)) return true;

  const lastWord = normalized.split(/\s+/).pop() || '';
  if (lastWord.length <= 3) return true;

  return normalized.length >= 90;
}

async function generateAIResponse(
  bot: AIBot, 
  userMessage: string, 
  conversationHistory: Array<{role: string, content: string}>,
  contactName: string,
  messageCount: number = 0,
  products: BotProduct[] = [],
  faqs: Array<{question: string, answer: string}> = [],
  semanticResults: SemanticSearchResult[] = [],
  leadMemory: LeadMemoryContext | null = null,
  modelOverride: string | null = null
): Promise<{ response: string; tokensUsed: number; modelUsed: string }> {
  const modelToUse = modelOverride || bot.ai_model_chat || 'google/gemini-3-flash-preview';
  const historyLimit = modelToUse.includes('gemini-2.5-pro') ? 12 : 20;
  const recentHistory = conversationHistory.slice(-historyLimit);

  const personalityPrompt = buildBotPersonalityPrompt(bot);
  const productsContext = buildProductsContext(products);
  const faqContext = buildFAQContext(faqs);
  const semanticContext = buildSemanticContext(semanticResults);

  const leadMemoryContext = leadMemory ? `
════════════════════════════════════════════
🧠 MEMÓRIA DO CLIENTE (informações aprendidas em conversas anteriores)
════════════════════════════════════════════
${buildLeadMemoryPrompt(leadMemory)}
════════════════════════════════════════════` : '';
  
  const qualificationInstructions = `
═══════════════════════════════════════════════════
DIRETRIZES DE HUMANIZAÇÃO MÁXIMA
═══════════════════════════════════════════════════

IDENTIDADE: Você é uma PESSOA REAL. Você NÃO é um chatbot, assistente virtual ou IA.
Se perguntarem se você é robô/IA, desvie naturalmente sem confirmar nem negar.

ESTILO DE CONVERSA NO WHATSAPP:
- Escreva como uma pessoa REAL escreveria no WhatsApp
- Frases curtas e diretas. Quebre mensagens longas em parágrafos curtos
- Use linguagem coloquial brasileira natural (não formal demais)
- Varie suas expressões - NUNCA repita a mesma frase ou estrutura entre mensagens
- Demonstre emoção: surpresa, empolgação, empatia conforme o contexto
- Reaja ao que o cliente disse antes de responder
- Faça UMA pergunta por vez, não bombardeie com múltiplas perguntas
- SEMPRE termine a mensagem com uma frase completa
- NUNCA termine no meio de palavra ou no meio de raciocínio

CONSCIÊNCIA DE CONTEXTO (CRÍTICO):
- LEIA TODO o histórico da conversa antes de responder
- Se você já se apresentou, NÃO se apresente novamente
- Se já fez uma pergunta, NÃO repita a mesma pergunta
- Se o cliente já respondeu algo, NÃO peça a mesma informação
- Se a conversa foi retomada após pausa, reconheça naturalmente
- NUNCA diga "Como posso ajudar?" se já está no meio de uma conversa

INTELIGÊNCIA EMOCIONAL:
- Se o cliente está animado → compartilhe a empolgação
- Se está com dúvida → seja paciente e explique com calma
- Se está com pressa → seja direto e objetivo
- Se está frustrado → acolha primeiro, resolva depois
- Se faz uma piada → ria junto, seja leve
- Se manda apenas "?" ou "oi" → responda naturalmente, não com um textão

REGRAS DE OURO:
1. Primeira resposta em conversa nova: apresente-se brevemente e faça UMA pergunta para entender a necessidade
2. Respostas subsequentes: NUNCA repita sua apresentação
3. Quando conhecer o nome do cliente: USE o nome dele nas respostas
4. Não seja genérico - seja específico ao contexto da conversa
5. Se não sabe algo: "Vou verificar isso pra você" é melhor que inventar

⚠️ REGRA CRÍTICA ANTI-ALUCINAÇÃO (MÁXIMA PRIORIDADE):
- NUNCA invente informações, dados, preços, especificações, nomes, datas ou qualquer fato que você não tenha recebido explicitamente no contexto
- Se o cliente perguntar algo que NÃO está na sua base de conhecimento, FAQ ou catálogo de produtos: diga "Vou verificar essa informação pra você" ou "Deixa eu confirmar isso e já te retorno"
- JAMAIS crie dados fictícios para parecer que sabe a resposta — isso destrói a confiança do cliente
- Se não tem certeza absoluta sobre um dado (preço, estoque, prazo, especificação técnica): NÃO responda com um valor inventado
- É MELHOR dizer "não tenho essa informação agora" do que inventar QUALQUER dado
- Esta regra tem PRIORIDADE MÁXIMA sobre todas as outras — inclusive sobre a diretriz de ser prestativo

${leadMemory ? `
MEMÓRIA DO CLIENTE (USE ISSO!):
- Você JÁ CONHECE este cliente de conversas anteriores
- NÃO pergunte nome, preferências ou informações que você já sabe
- Referencie conversas anteriores naturalmente` : ''}

REGRA CRÍTICA SOBRE TRANSFERÊNCIA:
- NUNCA mencione "especialista", "consultor", "time" ou "vou chamar alguém" na sua resposta
- NUNCA diga que vai transferir, encaminhar ou chamar outra pessoa
- Você É a especialista. Responda TUDO que souber sobre o produto/serviço
- Se não souber algo específico, diga "vou verificar isso pra você" e continue a conversa
- Só transfira se o cliente pedir EXPLICITAMENTE para falar com pessoa/humano/atendente (usando essas palavras)
- Após 5+ trocas sobre o MESMO problema sem resolver
- NUNCA transfira nas primeiras 5 mensagens
- Perguntas sobre funcionalidades, preços, páginas de venda, etc. são SUA responsabilidade responder

CONVERSA RETOMADA (quando há histórico anterior):
- NÃO se apresente novamente
- NÃO envie welcome message
- Continue de onde parou
- Reconheça que o cliente voltou de forma natural
- Revise o que foi discutido e dê continuidade
═══════════════════════════════════════════════════`;

  const hasCustomSystemPrompt = bot.system_prompt && bot.system_prompt.length > 0;
  const outputGuardrails = `

REGRAS OBRIGATÓRIAS DE SAÍDA:
- Sua resposta DEVE terminar com ponto final, interrogação, exclamação ou reticências intencionais
- NUNCA termine no meio de palavra
- NUNCA termine no meio de frase
- Se precisar ser breve, feche a ideia em 1 ou 2 frases completas`;
  
  const systemPrompt = `${personalityPrompt}

${hasCustomSystemPrompt ? `\n${bot.system_prompt}\n` : ''}

CONTEXTO ATUAL:
- Cliente: ${leadMemory?.lead_name || contactName}
- Data/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
- Mensagens na conversa: ${messageCount}
- ${messageCount > 0 ? 'CONVERSA EM ANDAMENTO - NÃO se apresente novamente' : 'NOVA CONVERSA'}

${leadMemoryContext}

${semanticContext}

${productsContext}

${faqContext}

${qualificationInstructions}
${outputGuardrails}

LEMBRE-SE: Você é um HUMANO conversando pelo WhatsApp. Cada resposta deve parecer que foi digitada por uma pessoa real, não gerada por máquina.
${leadMemory ? 'PRIORIZE usar as informações da MEMÓRIA DO CLIENTE para personalizar o atendimento!' : ''}
${semanticResults.length > 0 ? 'Use as informações da busca semântica para responder perguntas técnicas.' : ''}`;

  const baseMessages = [
    { role: 'system', content: systemPrompt },
    ...recentHistory,
    { role: 'user', content: userMessage }
  ];

  console.log('🤖 Calling AI model:', modelToUse, 'with enriched context:', {
    hasProducts: products.length > 0,
    hasFAQs: faqs.length > 0,
    hasSemanticResults: semanticResults.length > 0,
    personality: !!personalityPrompt,
    messagesCount: baseMessages.length,
    historyMessages: recentHistory.length
  });

  // Helper: log provider failure for monitoring
  async function logProviderFailure(provider: string, model: string, errorCode: string, errorMsg: string, fallbackProvider: string | null, fallbackOk: boolean) {
    try {
      await supabase.from('ai_provider_failure_logs').insert({
        organization_id: bot.organization_id,
        conversation_id: conversationHistory.length > 0 ? 'ctx' : null,
        bot_id: bot.id,
        provider,
        model,
        error_code: errorCode,
        error_message: errorMsg.substring(0, 500),
        fallback_provider: fallbackProvider,
        fallback_succeeded: fallbackOk,
      });
    } catch (e) {
      console.error('⚠️ Failed to log provider failure:', e);
    }
  }

  async function callModel(chatMessages: Array<{ role: string; content: string }>, overrideTemperature?: number): Promise<{ response: string; tokensUsed: number; modelUsed: string }> {
    const isProModel = modelToUse.includes('gemini-2.5-pro') || modelToUse.includes('gemini-3.1-pro') || modelToUse.includes('gpt-5');

    // ====================================================================
    // STRATEGY: Lovable AI Gateway (Gemini) is PRIMARY for all models
    // Groq is FALLBACK only (avoids 100k token/day rate limits)
    // ====================================================================

    if (GEMINI_API_KEY || LOVABLE_API_KEY) {
      const gatewayModel = isProModel ? modelToUse : 'google/gemini-2.5-flash';
      console.log('🧠 PRIMARY: Lovable AI Gateway:', gatewayModel);

      try {

        const response = await fetch(_aiUrl(), {
          method: "POST",
          headers: _aiHeaders(),
          body: JSON.stringify({
            model: _aiModel(gatewayModel),
            messages: chatMessages,
            max_tokens: isProModel ? 1200 : 900,
            temperature: overrideTemperature ?? (isProModel ? 0.55 : 0.65),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const aiResponse = normalizeAIResponse(data.choices?.[0]?.message?.content || '');
          const tokensUsed = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);
          console.log('✅ AI Response via Lovable Gateway:', gatewayModel, aiResponse.substring(0, 100) + '...');
          return { response: aiResponse, tokensUsed, modelUsed: `lovable/${gatewayModel}` };
        }

        const errorText = await response.text();
        console.error('❌ Lovable Gateway failed:', response.status, errorText);
        await logProviderFailure('lovable', gatewayModel, String(response.status), errorText, 'groq', false);

        // 402 = no credits on Lovable AI — fall through to Groq fallback instead of throwing
        if (response.status === 402) {
          console.log('⚠️ Lovable AI credits exhausted (402), falling through to Groq fallback...');
        }
      } catch (err: any) {
        console.error('❌ Lovable Gateway exception:', err);
        await logProviderFailure('lovable', gatewayModel, 'exception', String(err), 'groq', false);
      }
    }

    // FALLBACK: Groq (with retry on 429 rate limit)
    const groqModel = mapModelToGroq(modelToUse);
    console.log('🔄 FALLBACK: Groq model:', groqModel);

    const MAX_GROQ_RETRIES = 3;
    let groqResponse: Response | null = null;

    for (let attempt = 1; attempt <= MAX_GROQ_RETRIES; attempt++) {
      groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: groqModel,
          messages: chatMessages,
          max_tokens: 900,
          temperature: overrideTemperature ?? 0.65,
        }),
      });

      if (groqResponse.ok) break;

      if (groqResponse.status === 429 && attempt < MAX_GROQ_RETRIES) {
        // Parse retry-after or use exponential backoff
        const retryAfterHeader = groqResponse.headers.get('retry-after');
        const waitSeconds = retryAfterHeader ? Math.min(parseFloat(retryAfterHeader), 30) : (attempt * 5);
        console.log(`⏳ Groq 429 rate limited (attempt ${attempt}/${MAX_GROQ_RETRIES}), waiting ${waitSeconds}s...`);
        await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
        continue;
      }

      // Non-429 error or last attempt
      break;
    }

    if (!groqResponse || !groqResponse.ok) {
      const errorText = groqResponse ? await groqResponse.text() : 'No response';
      const statusCode = groqResponse?.status || 0;
      console.error('❌ Groq FALLBACK failed after retries:', statusCode, errorText);
      await logProviderFailure('groq', groqModel, String(statusCode), errorText, null, false);

      if (statusCode === 429) {
        throw new Error('RATE_LIMITED');
      }
      throw new Error(`AI_ERROR: ${statusCode}`);
    }

    // Log that primary failed but fallback succeeded
    await logProviderFailure('lovable', modelToUse, 'primary_failed', 'Fell back to Groq', 'groq', true);

    const data = await groqResponse.json();
    const aiResponse = normalizeAIResponse(data.choices?.[0]?.message?.content || '');
    const tokensUsed = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);

    console.log('✅ AI Response via Groq fallback:', groqModel, aiResponse.substring(0, 100) + '...');
    return { response: aiResponse, tokensUsed, modelUsed: `groq/${groqModel}` };
  }

  let result = await callModel(baseMessages);

  if (looksTruncatedAIResponse(result.response)) {
    console.warn('⚠️ AI response looks truncated, attempting repair...', {
      modelUsed: result.modelUsed,
      preview: result.response.substring(0, 120)
    });

    const repairedMessages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.slice(-8),
      {
        role: 'user',
        content: `${userMessage}\n\nResponda novamente de forma COMPLETA, em no máximo 2 frases curtas, e finalize corretamente. Nunca pare no meio de palavra ou de frase.`
      }
    ];

    try {
      const repairedResult = await callModel(repairedMessages, 0.4);
      if (!looksTruncatedAIResponse(repairedResult.response) || hasTerminalPunctuation(repairedResult.response)) {
        result = repairedResult;
      } else {
        const trimmed = trimToCompleteBoundary(repairedResult.response);
        if (trimmed && hasTerminalPunctuation(trimmed)) {
          result = { ...repairedResult, response: trimmed };
        }
      }
    } catch (repairError) {
      console.error('⚠️ Failed to repair truncated AI response:', repairError);
      const trimmed = trimToCompleteBoundary(result.response);
      if (trimmed && hasTerminalPunctuation(trimmed)) {
        result = { ...result, response: trimmed };
      }
    }
  }

  return { ...result, response: normalizeAIResponse(result.response) };
}

// ============================================================================
// SEND MESSAGE VIA EVOLUTION
// ============================================================================

async function sendWhatsAppMessage(
  instanceName: string, 
  chatId: string, 
  message: string,
  conversationId: string,
  instanceId: string,
  botId: string
): Promise<boolean> {
  try {
    const endpoint = `${EVOLUTION_API_URL}/message/sendText/${instanceName}`;
    
    console.log('📤 Sending message via Evolution:', {
      instance: instanceName,
      chatId,
      messagePreview: message.substring(0, 50) + '...'
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: chatId,
        text: message,
      }),
    });

    if (!response.ok) {
      console.error('❌ Evolution send failed:', response.status);
      return false;
    }

    const result = await response.json();
    const providerMessageId = result?.key?.id || null;

    // Salvar mensagem no banco
    await supabase.from('whatsapp_messages').insert({
      id: crypto.randomUUID(),
      instance_id: instanceId,
      conversation_id: conversationId,
      message_type: 'text',
      content: message,
      direction: 'outbound',
      status: 'sent',
      is_from_bot: true,
      provider: 'evolution',
      provider_message_id: providerMessageId,
    });

    console.log('✅ Bot message sent and saved');
    return true;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    return false;
  }
}

// Send audio message via Evolution API
async function sendWhatsAppAudio(
  instanceName: string,
  chatId: string,
  audioUrl: string,
  conversationId: string,
  instanceId: string,
  botId: string
): Promise<boolean> {
  try {
    const endpoint = `${EVOLUTION_API_URL}/message/sendWhatsAppAudio/${instanceName}`;
    
    console.log('🎤 Sending audio message:', { instanceName, chatId, audioUrl: audioUrl.substring(0, 50) + '...' });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: chatId,
        audio: audioUrl,
      }),
    });

    if (!response.ok) {
      console.error('❌ Evolution audio send failed:', response.status);
      return false;
    }

    const result = await response.json();
    const providerMessageId = result?.key?.id || null;

    // Salvar mensagem no banco
    await supabase.from('whatsapp_messages').insert({
      id: crypto.randomUUID(),
      instance_id: instanceId,
      conversation_id: conversationId,
      message_type: 'audio',
      media_url: audioUrl,
      direction: 'outbound',
      status: 'sent',
      is_from_bot: true,
      provider: 'evolution',
      provider_message_id: providerMessageId,
    });

    console.log('✅ Bot audio message sent and saved');
    return true;
  } catch (error) {
    console.error('❌ Error sending audio:', error);
    return false;
  }
}

// Send image message via Evolution API
async function sendWhatsAppImage(
  instanceName: string,
  chatId: string,
  imageUrl: string,
  caption: string | null,
  conversationId: string,
  instanceId: string,
  botId: string
): Promise<boolean> {
  try {
    const endpoint = `${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`;
    
    console.log('📷 Sending image message:', { instanceName, chatId, imageUrl: imageUrl.substring(0, 50) + '...', hasCaption: !!caption });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: chatId,
        mediatype: 'image',
        media: imageUrl,
        caption: caption || '',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Evolution image send failed:', response.status, errorText);
      return false;
    }

    const result = await response.json();
    const providerMessageId = result?.key?.id || null;

    // Salvar mensagem no banco
    await supabase.from('whatsapp_messages').insert({
      id: crypto.randomUUID(),
      instance_id: instanceId,
      conversation_id: conversationId,
      message_type: 'image',
      media_url: imageUrl,
      content: caption || '',
      direction: 'outbound',
      status: 'sent',
      is_from_bot: true,
      provider: 'evolution',
      provider_message_id: providerMessageId,
    });

    console.log('✅ Bot image message sent and saved');
    return true;
  } catch (error) {
    console.error('❌ Error sending image:', error);
    return false;
  }
}

// Detect products mentioned in AI response and send their media
// ============================================================================
// PRODUCT IMAGE RESOLUTION (PRODUCT-SCOPED)
// ============================================================================

/**
 * Get all available images for a product as an ordered list.
 * Order: image_url (main) → label_image_url → ecommerce_images[]
 */
function getProductImageGallery(product: BotProduct): string[] {
  const images: string[] = [];
  
  if (product.image_url) {
    images.push(product.image_url);
  }
  if (product.label_image_url) {
    images.push(product.label_image_url);
  }
  if (product.ecommerce_images && Array.isArray(product.ecommerce_images)) {
    for (const img of product.ecommerce_images) {
      if (img && !images.includes(img)) {
        images.push(img);
      }
    }
  }
  
  return images;
}

/**
 * Find which product the user is asking about based on their message.
 * Returns the matched product or null.
 */
function detectProductFromUserMessage(
  userMessage: string,
  products: BotProduct[]
): BotProduct | null {
  const normalizedMessage = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Score each product by how well it matches the user message
  let bestMatch: BotProduct | null = null;
  let bestScore = 0;
  
  for (const product of products) {
    const productNameNormalized = product.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Check for exact product name match first
    if (normalizedMessage.includes(productNameNormalized)) {
      // Prefer longer/more specific names
      const score = productNameNormalized.length + 100;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
      continue;
    }
    
    // Check individual words (at least 3 chars)
    const words = productNameNormalized.split(/\s+/).filter(w => w.length >= 3);
    let wordMatches = 0;
    for (const word of words) {
      if (normalizedMessage.includes(word)) {
        wordMatches++;
      }
    }
    
    // Require at least one significant word match
    if (wordMatches > 0) {
      const score = wordMatches * 10 + productNameNormalized.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }
  }
  
  return bestMatch;
}

/**
 * Check if user is asking for another/more photos.
 */
function isAskingForMorePhotos(userMessage: string): boolean {
  const normalizedMessage = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const morePhotoPatterns = [
    'outra foto',
    'outras fotos',
    'mais foto',
    'mais fotos',
    'outro angulo',
    'outros angulos',
    'outra imagem',
    'mais imagem',
    'mais imagens',
    'tem outra',
    'tem mais',
    'mostra outra',
    'mostra mais',
    'envie outra',
    'envia outra',
    'manda outra',
    'quero ver mais',
    'ver outra foto',
    'ver outra imagem',
  ];
  
  return morePhotoPatterns.some(pattern => normalizedMessage.includes(pattern));
}

/**
 * Get images already sent for a specific product in this conversation.
 */
async function getProductImagesSentInConversation(
  conversationId: string,
  productId: string
): Promise<string[]> {
  try {
    // Query messages in this conversation that are bot images
    const { data: messages } = await supabase
      .from('whatsapp_messages')
      .select('media_url, content')
      .eq('conversation_id', conversationId)
      .eq('message_type', 'image')
      .eq('is_from_bot', true)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!messages) return [];
    
    // Filter images that mention this product in caption
    const productImages: string[] = [];
    const productNameLower = productId.toLowerCase();
    
    for (const msg of messages) {
      if (msg.media_url) {
        // We'll collect all bot images - can't perfectly filter by product_id
        // but the content/caption usually contains product name
        productImages.push(msg.media_url);
      }
    }
    
    return productImages;
  } catch (error) {
    console.error('Error fetching sent images:', error);
    return [];
  }
}

/**
 * REFACTORED: Send product media strictly based on the active product.
 * - Resolves image from USER's message, not AI response
 * - Tracks which images were sent to avoid duplicates
 * - Handles "outra foto" requests properly
 */
async function sendProductMedia(
  bot: AIBot,
  products: BotProduct[],
  aiResponse: string,
  instanceName: string,
  chatId: string,
  conversationId: string,
  instanceId: string,
  userMessage: string = '' // NEW: user message for product detection
): Promise<{ imagesSent: number; linksSent: number }> {
  let imagesSent = 0;
  let linksSent = 0;

  // Skip if no products or bot has media sending disabled
  if (products.length === 0) {
    return { imagesSent, linksSent };
  }

  const sendImages = bot.send_product_images ?? true;
  const sendLinks = bot.send_product_links ?? true;
  
  if (!sendImages && !sendLinks) {
    console.log('📷 Product media sending disabled for bot');
    return { imagesSent, linksSent };
  }

  // STEP 1: Detect which product the USER asked about (not from AI response)
  const detectedProduct = detectProductFromUserMessage(userMessage, products);
  
  if (!detectedProduct) {
    console.log('📷 No product detected in user message, skipping media');
    return { imagesSent, linksSent };
  }
  
  console.log(`📷 Product detected from user message: "${detectedProduct.name}" (ID: ${detectedProduct.id})`);
  
  // STEP 2: Check if user is asking for more photos
  const wantsMorePhotos = isAskingForMorePhotos(userMessage);
  
  // STEP 3: Get all available images for this product
  const productGallery = getProductImageGallery(detectedProduct);
  console.log(`📷 Product "${detectedProduct.name}" has ${productGallery.length} images in gallery`);
  
  if (productGallery.length === 0 || !detectedProduct.bot_can_send_image || !sendImages) {
    // No images available or not allowed
    if (wantsMorePhotos) {
      // User asked for photos but none available - let AI response handle it
      console.log('📷 User asked for more photos but product has no images');
    }
    return { imagesSent, linksSent };
  }
  
  // STEP 4: Get images already sent for THIS product
  const sentImages = await getProductImagesSentInConversation(conversationId, detectedProduct.id);
  console.log(`📷 Already sent ${sentImages.length} images in this conversation`);
  
  // STEP 5: Find next image to send
  let imageToSend: string | null = null;
  let imageIndex = 0;
  
  if (wantsMorePhotos) {
    // User wants another photo - find one not yet sent
    for (let i = 0; i < productGallery.length; i++) {
      const img = productGallery[i];
      if (!sentImages.includes(img)) {
        imageToSend = img;
        imageIndex = i;
        break;
      }
    }
    
    if (!imageToSend) {
      // All images already sent
      console.log('📷 All product images already sent, no more available');
      // Don't send anything - let AI response indicate no more photos
      return { imagesSent, linksSent };
    }
  } else {
    // First time asking about this product or showing product
    // Check if AI response mentions sending photo/image
    const normalizedResponse = aiResponse.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const mentionsPhoto = normalizedResponse.includes('foto') || 
                          normalizedResponse.includes('imagem') ||
                          normalizedResponse.includes('enviar') ||
                          normalizedResponse.includes('confira');
    
    // Also check if product name is in AI response (confirmation it's talking about this product)
    const productNameNormalized = detectedProduct.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const productWords = productNameNormalized.split(/\s+/).filter(w => w.length >= 3);
    const productMentionedInResponse = productWords.some(word => normalizedResponse.includes(word));
    
    if (!productMentionedInResponse && !mentionsPhoto) {
      console.log('📷 AI response does not mention product or photos, skipping media');
      return { imagesSent, linksSent };
    }
    
    // Send first image that hasn't been sent recently (in last 5 messages)
    // This allows re-sending after conversation progresses
    const recentSentImages = sentImages.slice(0, 5);
    
    for (const img of productGallery) {
      if (!recentSentImages.includes(img)) {
        imageToSend = img;
        break;
      }
    }
    
    // If all recent, just send the first one again
    if (!imageToSend && productGallery.length > 0) {
      imageToSend = productGallery[0];
    }
  }
  
  // STEP 6: Send the image
  if (imageToSend) {
    console.log(`📷 Sending image ${imageIndex + 1}/${productGallery.length} for product: ${detectedProduct.name}`);
    const imageSent = await sendWhatsAppImage(
      instanceName,
      chatId,
      imageToSend,
      `📸 ${detectedProduct.name}`,
      conversationId,
      instanceId,
      bot.id
    );
    if (imageSent) {
      imagesSent++;
      // Small delay between media messages
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // STEP 7: Send product link if enabled and available (only on first mention)
  if (!wantsMorePhotos && sendLinks && detectedProduct.bot_can_send_site_link && detectedProduct.hot_site_url) {
    console.log(`🔗 Sending link for product: ${detectedProduct.name}`);
    const linkSent = await sendWhatsAppMessage(
      instanceName,
      chatId,
      `🔗 Confira mais detalhes: ${detectedProduct.hot_site_url}`,
      conversationId,
      instanceId,
      bot.id
    );
    if (linkSent) {
      linksSent++;
    }
  }

  console.log(`📷 Product media sent: ${imagesSent} images, ${linksSent} links`);
  return { imagesSent, linksSent };
}

// ============================================================================
// ENERGY MANAGEMENT
// ============================================================================

async function checkAndConsumeEnergy(
  organizationId: string, 
  botId: string,
  conversationId: string,
  tokensUsed: number,
  actionType: string,
  modelUsed: string = 'google/gemini-2.5-flash',
  realCostUsd: number | null = null
): Promise<{ success: boolean; energyConsumed: number }> {
  // Calcular energia baseada em tokens (1 energia = ~100 tokens para modelo padrão)
  // Para modelos mais caros, ajustar proporcionalmente
  let energyMultiplier = 1;
  if (modelUsed.includes('gemini-2.5-pro') || modelUsed.includes('gemini-3-pro')) {
    energyMultiplier = 3; // Modelos pro custam 3x mais
  } else if (modelUsed.includes('gpt-5.2') || modelUsed.includes('gpt-5')) {
    energyMultiplier = 5; // GPT-5 custa 5x mais
  }
  
  const baseEnergy = Math.max(1, Math.ceil(tokensUsed / 100));
  const energyToConsume = Math.max(1, Math.ceil(baseEnergy * energyMultiplier));

  // Estimar custo real se não foi passado (baseado em custos médios)
  const estimatedCost = realCostUsd ?? (tokensUsed / 1000000 * 0.5); // ~$0.50 por 1M tokens médio

  // Consumir energia via RPC (também registra metadados/uso no backend)
  const { data, error } = await supabase.rpc('consume_energy', {
    p_organization_id: organizationId,
    p_bot_id: botId,
    p_conversation_id: conversationId,
    p_action_type: actionType,
    p_energy_amount: energyToConsume,
    p_tokens_used: tokensUsed,
    p_details: { timestamp: new Date().toISOString() },
    p_model_used: modelUsed,
    p_real_cost_usd: estimatedCost,
  });

  if (error) {
    console.error('⚡ consume_energy error:', error);
    return { success: false, energyConsumed: 0 };
  }

  // A função pode retornar boolean ou JSON (dependendo da implementação)
  const ok = typeof data === 'boolean' ? data : (data?.success ?? true);

  if (!ok) {
    console.log('⚡ No energy available');
    return { success: false, energyConsumed: 0 };
  }

  console.log('⚡ Energy consumed:', energyToConsume, 'model:', modelUsed);
  return { success: true, energyConsumed: energyToConsume };
}

// ============================================================================
// TRANSFER TO HUMAN
// ============================================================================

async function transferToHuman(
  conversationId: string,
  reason: string,
  transferMessage: string | null
): Promise<void> {
  console.log('🔄 Transferring to human:', reason);

  // Usar a função do banco para transferir
  await supabase.rpc('transfer_from_bot_to_human', {
    p_conversation_id: conversationId
  });

  // Se tem mensagem de transferência, ela já foi enviada ou será enviada
  console.log('✅ Transferred to human, status now pending');
}

// ============================================================================
// QUALIFICATION LOGIC
// ============================================================================

async function processQualification(
  bot: AIBot,
  context: ConversationContext,
  userMessage: string,
  instanceName: string
): Promise<{ shouldContinue: boolean; result?: ProcessResult }> {
  
  // Se qualificação não está habilitada ou já foi completada, continuar normal
  if (!bot.initial_qualification_enabled || !bot.initial_questions || bot.initial_questions.length === 0) {
    return { shouldContinue: true };
  }

  if (context.qualificationCompleted) {
    return { shouldContinue: true };
  }

  const questions = bot.initial_questions;
  const currentStep = context.qualificationStep;

  console.log('📋 Qualification step:', currentStep, 'of', questions.length);

  // Se é o primeiro passo (step = 0), enviar primeira pergunta
  if (currentStep === 0) {
    const firstQuestion = questions[0];
    const questionMessage = formatQualificationQuestion(firstQuestion, 1, questions.length);
    
    await sendWhatsAppMessage(
      instanceName,
      context.chatId,
      questionMessage,
      context.conversationId,
      context.instanceId,
      bot.id
    );

    // Atualizar step para 1 (esperando resposta da primeira pergunta)
    await supabase
      .from('whatsapp_conversations')
      .update({ bot_qualification_step: 1 })
      .eq('id', context.conversationId);

    // Consumir energia
    await checkAndConsumeEnergy(context.organizationId, bot.id, context.conversationId, 30, 'qualification_question');

    return { 
      shouldContinue: false, 
      result: { success: true, action: 'qualification', message: 'First question sent' } 
    };
  }

  // Salvar resposta da pergunta anterior
  const previousQuestion = questions[currentStep - 1];
  if (context.leadId) {
    await saveQualificationAnswer(
      context.leadId,
      context.organizationId,
      previousQuestion,
      userMessage
    );
    console.log('✅ Saved answer for question:', previousQuestion.questionText);
  }

  // Verificar se há mais perguntas
  if (currentStep < questions.length) {
    const nextQuestion = questions[currentStep];
    const questionMessage = formatQualificationQuestion(nextQuestion, currentStep + 1, questions.length);
    
    await sendWhatsAppMessage(
      instanceName,
      context.chatId,
      questionMessage,
      context.conversationId,
      context.instanceId,
      bot.id
    );

    // Atualizar step
    await supabase
      .from('whatsapp_conversations')
      .update({ bot_qualification_step: currentStep + 1 })
      .eq('id', context.conversationId);

    // Consumir energia
    await checkAndConsumeEnergy(context.organizationId, bot.id, context.conversationId, 30, 'qualification_question');

    return { 
      shouldContinue: false, 
      result: { success: true, action: 'qualification', message: `Question ${currentStep + 1} sent` } 
    };
  }

  // Todas as perguntas foram respondidas
  await supabase
    .from('whatsapp_conversations')
    .update({ bot_qualification_completed: true })
    .eq('id', context.conversationId);

  console.log('✅ Qualification completed');

  // Enviar mensagem de transição
  const transitionMessage = `Obrigado pelas informações, ${context.contactName}! 🙏 Agora posso te ajudar melhor. Como posso te atender?`;
  
  await sendWhatsAppMessage(
    instanceName,
    context.chatId,
    transitionMessage,
    context.conversationId,
    context.instanceId,
    bot.id
  );

  await checkAndConsumeEnergy(context.organizationId, bot.id, context.conversationId, 30, 'qualification_complete');

  return { shouldContinue: true };
}

function formatQualificationQuestion(question: InitialQuestion, number: number, total: number): string {
  const prefix = `📋 *Pergunta ${number}/${total}*\n\n`;
  return prefix + question.questionText;
}

async function saveQualificationAnswer(
  leadId: string,
  organizationId: string,
  question: InitialQuestion,
  answer: string
): Promise<void> {
  try {
    // Preparar dados baseado no tipo de pergunta
    const answerData: any = {
      lead_id: leadId,
      question_id: question.questionId,
      organization_id: organizationId,
      updated_at: new Date().toISOString(),
    };

    switch (question.questionType) {
      case 'number':
        // Tentar extrair número da resposta
        const numMatch = answer.match(/\d+([.,]\d+)?/);
        if (numMatch) {
          answerData.numeric_value = parseFloat(numMatch[0].replace(',', '.'));
        }
        break;
      
      case 'text':
        answerData.text_value = answer;
        break;

      case 'imc_calculator':
        // Tentar extrair peso, altura e idade da resposta
        // Formato esperado: "75kg 1.70m 30 anos" ou similar
        const weightMatch = answer.match(/(\d+([.,]\d+)?)\s*(kg|quilo)/i);
        const heightMatch = answer.match(/(\d+([.,]\d+)?)\s*(m|metro|cm)/i);
        const ageMatch = answer.match(/(\d+)\s*(anos?|age)/i);
        
        if (weightMatch) {
          answerData.imc_weight = parseFloat(weightMatch[1].replace(',', '.'));
        }
        if (heightMatch) {
          let height = parseFloat(heightMatch[1].replace(',', '.'));
          // Se altura > 3, provavelmente está em cm
          if (height > 3) height = height / 100;
          answerData.imc_height = height;
        }
        if (ageMatch) {
          answerData.imc_age = parseInt(ageMatch[1]);
        }
        
        // Calcular IMC se tiver peso e altura
        if (answerData.imc_weight && answerData.imc_height) {
          const imc = answerData.imc_weight / (answerData.imc_height * answerData.imc_height);
          answerData.imc_result = Math.round(imc * 100) / 100;
          
          // Categorizar
          if (imc < 18.5) answerData.imc_category = 'Abaixo do peso';
          else if (imc < 25) answerData.imc_category = 'Peso normal';
          else if (imc < 30) answerData.imc_category = 'Sobrepeso';
          else if (imc < 35) answerData.imc_category = 'Obesidade grau I';
          else if (imc < 40) answerData.imc_category = 'Obesidade grau II';
          else answerData.imc_category = 'Obesidade grau III';
        }
        break;
      
      case 'single_choice':
      case 'multiple_choice':
        // Para escolhas, salvar o texto como referência
        // Idealmente, buscaríamos as opções e matchearíamos
        answerData.text_value = answer;
        break;
      
      default:
        answerData.text_value = answer;
    }

    // Upsert a resposta
    const { error } = await supabase
      .from('lead_standard_question_answers')
      .upsert(answerData, {
        onConflict: 'lead_id,question_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('❌ Error saving qualification answer:', error);
    }
  } catch (err) {
    console.error('❌ Error in saveQualificationAnswer:', err);
  }
}

// ============================================================================
// MAIN PROCESS
// ============================================================================

async function processMessage(
  bot: AIBot,
  context: ConversationContext,
  userMessage: string,
  instanceName: string,
  isWithinSchedule: boolean = true, // Novo parâmetro - vem do webhook
  routingDepth: number = 0, // Protege contra loop infinito de roteamento entre especialistas
  incomingMessageType: string = 'text' // Tipo da mensagem recebida (text, audio, image)
): Promise<ProcessResult> {
  
  console.log('🤖 Processing message for bot:', bot.name, `(routing depth: ${routingDepth})`);
  
  // 0. Processar qualificação inicial (se habilitada)
  const qualificationResult = await processQualification(bot, context, userMessage, instanceName);
  if (!qualificationResult.shouldContinue && qualificationResult.result) {
    return qualificationResult.result;
  }

  // 1. Verificar horário de funcionamento (usando isWithinSchedule do webhook)
  // Se está fora do horário agendado, enviar mensagem de fora de horário mas CONTINUAR INTERAGINDO
  if (!isWithinSchedule) {
    console.log('⏰ Outside scheduled hours - will still respond with out-of-hours context');
    
    // Se é primeira mensagem fora do horário, enviar aviso
    // Depois continua processando normalmente para poder interagir
    if (context.botMessagesCount === 0 && bot.out_of_hours_message) {
      await sendWhatsAppMessage(
        instanceName,
        context.chatId,
        bot.out_of_hours_message,
        context.conversationId,
        context.instanceId,
        bot.id
      );
      
      // Consumir energia pelo aviso de fora de horário
      await checkAndConsumeEnergy(
        context.organizationId,
        bot.id,
        context.conversationId,
        30,
        'out_of_hours_message'
      );
      
      // Incrementar contador para não enviar novamente
      await supabase
        .from('whatsapp_conversations')
        .update({ bot_messages_count: 1 })
        .eq('id', context.conversationId);
      
      context.botMessagesCount = 1;
    }
    // Continua processando - o robô vai responder normalmente
  }

  // 1.5 VERIFICAR ROTEAMENTO DE TIME DE ROBÔS (antes de outras verificações)
  // Maestros e Especialistas podem rotear para outros membros do time
  const teamRouting = await getBotTeamRoutes(bot.id, context.organizationId);
  
  // Permitir roteamento tanto do maestro quanto de especialistas para outros colegas
  // MAS proteger contra loop infinito (máximo 2 níveis de roteamento)
  if (teamRouting.teamId && teamRouting.routes.length > 0 && routingDepth < 2) {
    const botRole = teamRouting.isInitialBot ? 'maestro' : 'specialist';
    console.log(`🎭 Bot is team ${botRole}, checking ${teamRouting.routes.length} routes...`, {
      teamId: teamRouting.teamId,
      routesCount: teamRouting.routes.length
    });
    
    // STEP 1: Try keyword matching first (fast, no AI cost)
    let matchedRoute = matchRouteByKeywords(userMessage, teamRouting.routes);
    let matchType = 'keyword';
    let confidenceScore = 100;
    let classificationReason = 'keyword_match';
    
    // STEP 2: If no keyword match, try AI intent classification (smart routing)
    if (!matchedRoute) {
      console.log('🔑 No keyword match, trying AI intent classification...');
      const conversationHistoryForRouting = await getConversationHistory(context.conversationId, 6);
      const intentResult = await matchRouteByAIIntent(
        userMessage,
        conversationHistoryForRouting,
        teamRouting.routes,
        bot.name
      );
      
      matchedRoute = intentResult.route;
      matchType = 'ai_intent';
      confidenceScore = intentResult.confidenceScore;
      classificationReason = intentResult.reason;
      
      if (matchedRoute) {
        // Consume a small amount of energy for the AI classification
        await checkAndConsumeEnergy(
          context.organizationId,
          bot.id,
          context.conversationId,
          50, // ~50 tokens for classification
          'ai_intent_routing',
          'groq/llama-3.1-8b-instant'
        );
      }
    }

    // Log routing decision (always, for analytics)
    await logRoutingDecision({
      organizationId: context.organizationId,
      conversationId: context.conversationId,
      teamId: teamRouting.teamId,
      currentBotId: bot.id,
      targetBotId: matchedRoute?.target_bot_id || null,
      matchedRouteId: matchedRoute?.id || null,
      matchType: matchedRoute ? matchType : 'none',
      confidenceScore,
      userMessage,
      classificationReason,
      routesEvaluated: teamRouting.routes.length,
      decision: matchedRoute ? 'transferred' : 'kept_current',
    });
    
    if (matchedRoute) {
      console.log('🎯 Route matched!', {
        routeId: matchedRoute.id,
        targetBotId: matchedRoute.target_bot_id,
        matchType,
        confidenceScore,
        keywords: matchedRoute.keywords
      });
      
      // Trocar para o bot especialista/colega
      const switched = await switchToSpecialistBot(
        context.conversationId, 
        matchedRoute.target_bot_id, 
        matchedRoute
      );
      
      if (switched) {
        // Buscar o novo bot e reprocessar a mensagem com ele
        const specialistBot = await getBotById(matchedRoute.target_bot_id);
        
        if (specialistBot) {
          console.log('🤖 Reprocessing message with colleague:', specialistBot.name);
          
          // Atualizar contexto para o novo bot
          const newContext: ConversationContext = {
            ...context,
            botMessagesCount: 0, // Reset contador
          };
          
          // Processar recursivamente com o novo bot (incrementar depth para evitar loop)
          try {
            return await processMessage(specialistBot, newContext, userMessage, instanceName, isWithinSchedule, routingDepth + 1, incomingMessageType);
          } catch (routingError) {
            console.error('❌ Specialist bot failed to process, sending retry message:', routingError);
            
            // Fallback: send a generic message asking the customer to repeat
            const retryMessage = 'Desculpa, não apareceu sua última mensagem aqui. Pode repetir, por favor? 😊';
            await sendWhatsAppMessage(
              instanceName,
              context.chatId,
              retryMessage,
              context.conversationId,
              context.instanceId,
              matchedRoute.target_bot_id
            );
            
            return { success: true, action: 'retry_requested' as any, message: 'Specialist failed, asked customer to repeat' };
          }
        }
      }
    }
  } else if (routingDepth >= 2) {
    console.log('⚠️ Max routing depth reached, continuing with current bot');
  }

  // 2. Verificar keywords de transferência (para HUMANO)
  if (shouldTransferByKeywords(userMessage, bot.transfer_keywords)) {
    console.log('🔑 Transfer keyword detected');
    
    await transferToHuman(context.conversationId, 'keyword_trigger', bot.transfer_message);
    
    if (bot.transfer_message) {
      await sendWhatsAppMessage(
        instanceName,
        context.chatId,
        bot.transfer_message,
        context.conversationId,
        context.instanceId,
        bot.id
      );
    }
    
    return { success: true, action: 'transferred', message: 'Transfer keyword detected' };
  }

  // 3. Verificar limite de mensagens
  // Respeitar o valor configurado pelo usuário (mínimo de 1)
  const effectiveMaxMessages = bot.max_messages_before_transfer 
    ? Math.max(bot.max_messages_before_transfer, 1) 
    : 15; // Se não configurado, usar 15 como padrão
    
  if (context.botMessagesCount >= effectiveMaxMessages) {
    console.log('📊 Max messages reached, transferring');
    
    await transferToHuman(context.conversationId, 'max_messages', bot.transfer_message);
    
    if (bot.transfer_message) {
      await sendWhatsAppMessage(
        instanceName,
        context.chatId,
        bot.transfer_message,
        context.conversationId,
        context.instanceId,
        bot.id
      );
    }
    
    return { success: true, action: 'transferred', message: 'Max messages reached' };
  }

  // 4. Buscar histórico da conversa
  const conversationHistory = await getConversationHistory(context.conversationId);

  // 5. Buscar produtos e conhecimento do bot para contexto enriquecido
  const productScope = (bot as any).product_scope || 'all';
  const useRagSearch = (bot as any).use_rag_search ?? false;
  
  // 5.1 Buscar configurações globais de IA da organização
  const { data: orgAISettings } = await supabase
    .from('organizations')
    .select('whatsapp_ai_memory_enabled, whatsapp_ai_learning_enabled')
    .eq('id', context.organizationId)
    .single();
  
  const aiMemoryEnabled = (orgAISettings as any)?.whatsapp_ai_memory_enabled ?? false;
  const aiLearningEnabled = (orgAISettings as any)?.whatsapp_ai_learning_enabled ?? false;
  
  // 5.2 Buscar contexto de memória do lead (cross-session learning) - SOMENTE se habilitado
  let leadMemory: LeadMemoryContext | null = null;
  if (context.leadId && aiMemoryEnabled) {
    leadMemory = await getLeadMemoryContext(context.organizationId, context.leadId);
    if (leadMemory) {
      console.log('🧠 Lead memory loaded (memory enabled):', {
        hasPreferences: leadMemory.preferences.length > 0,
        hasLastSummary: !!leadMemory.last_summary,
        leadName: leadMemory.lead_name
      });
    }
  } else if (context.leadId && !aiMemoryEnabled) {
    console.log('🧠 Lead memory disabled globally, skipping');
  }
  
  const [products, faqs] = await Promise.all([
    getBotProducts(bot.id, context.organizationId, productScope),
    getBotKnowledge(bot.id)
  ]);
  
  // 5.2 Busca semântica (RAG) se habilitada
  let semanticResults: SemanticSearchResult[] = [];
  if (useRagSearch && productScope !== 'none') {
    // Get product IDs for filtering (if using selected scope)
    let productIds: string[] | null = null;
    if (productScope === 'selected' && products.length > 0) {
      productIds = products.map(p => p.id);
    }
    
    // Perform semantic search with user's message
    semanticResults = await semanticSearch(
      userMessage, 
      context.organizationId, 
      productIds,
      5 // Top 5 results
    );
  }
  
  console.log('📦 Bot context loaded:', { 
    products: products.length, 
    faqs: faqs.length,
    semanticResults: semanticResults.length,
    ragEnabled: useRagSearch,
    hasLeadMemory: !!leadMemory
  });

  // 6. Gerar resposta IA com contexto completo
  let aiResponse: string;
  let tokensUsed: number;
  let modelUsed: string = bot.ai_model_chat || 'google/gemini-3-flash-preview';
  
  try {
    const result = await generateAIResponse(
      bot, 
      userMessage, 
      conversationHistory, 
      context.contactName, 
      context.botMessagesCount,
      products,
      faqs,
      semanticResults,
      leadMemory
    );
    aiResponse = result.response;
    tokensUsed = result.tokensUsed;
    modelUsed = result.modelUsed;
  } catch (error: any) {
    const aiErrorMessage = error?.message || 'AI_UNAVAILABLE';
    console.error('❌ AI generation error:', aiErrorMessage);

    const isProviderUnavailable =
      aiErrorMessage === 'RATE_LIMITED' ||
      aiErrorMessage === 'PAYMENT_REQUIRED' ||
      /^AI_ERROR:\s*(402|429|5\d{2})$/.test(aiErrorMessage);

    if (isProviderUnavailable) {
      const transferReason = aiErrorMessage === 'PAYMENT_REQUIRED' ? 'no_credits' : 'ai_unavailable';
      await transferToHuman(context.conversationId, transferReason, bot.transfer_message);

      const fallbackMessage =
        bot.transfer_message ||
        'Tive uma instabilidade aqui e vou chamar um especialista do nosso time pra continuar com você.';

      const notified = await sendWhatsAppMessage(
        instanceName,
        context.chatId,
        fallbackMessage,
        context.conversationId,
        context.instanceId,
        bot.id
      );

      return {
        success: notified,
        action: aiErrorMessage === 'PAYMENT_REQUIRED' ? 'no_energy' : 'transferred',
        message: aiErrorMessage,
      };
    }
    
    return { success: false, action: 'error', message: aiErrorMessage };
  }

  // ====================================================================
  // POST-RESPONSE SANITIZATION: Prevent AI from mentioning transfers
  // ====================================================================
  const transferPhrases = [
    'chamar um especialista', 'chamar especialista', 'vou chamar',
    'passar para um especialista', 'transferir para', 'encaminhar para',
    'vou te passar', 'vou transferir', 'chamar alguém', 'chamar o time',
    'um especialista do nosso time', 'um especialista nosso',
    'pedir pra um especialista', 'vou pedir pro time',
    'chamar aqui', 'um segundinho', 'um minutinho'
  ];
  
  const responseLC = aiResponse.toLowerCase();
  const containsTransferMention = transferPhrases.some(phrase => responseLC.includes(phrase));
  
  if (containsTransferMention) {
    const MIN_MESSAGES_BEFORE_TRANSFER = Math.max(bot.max_messages_before_transfer || 8, 5);
    
    if (context.botMessagesCount < MIN_MESSAGES_BEFORE_TRANSFER) {
      console.log('🚫 AI mentioned transfer too early (msg #' + context.botMessagesCount + '/' + MIN_MESSAGES_BEFORE_TRANSFER + '). Regenerating...');
      
      // Regenerate with stronger guardrail
      try {
        const fixPrompt = `CORREÇÃO URGENTE: Sua resposta anterior mencionou "especialista" ou "transferir". 
Isso é PROIBIDO neste momento da conversa (mensagem #${context.botMessagesCount}).
Você É a especialista. Responda a pergunta do cliente diretamente.
Reescreva sua resposta SEM mencionar especialista, time, consultor, transferir ou chamar alguém.
Responda VOCÊ MESMA a dúvida do cliente.

Resposta original que precisa ser reescrita:
"${aiResponse}"

Reescreva agora de forma natural, respondendo a dúvida do cliente:`;
        
        const fixResult = await generateAIResponse(
          bot, fixPrompt, conversationHistory, context.contactName,
          context.botMessagesCount, products, faqs, semanticResults, leadMemory
        );
        aiResponse = fixResult.response;
        tokensUsed += fixResult.tokensUsed;
        console.log('✅ Response regenerated without transfer mention');
      } catch (fixError) {
        console.error('⚠️ Fix generation failed, stripping transfer phrases');
        // Fallback: remove transfer sentences
        aiResponse = aiResponse
          .split(/[.!?]\s+/)
          .filter(sentence => !transferPhrases.some(p => sentence.toLowerCase().includes(p)))
          .join('. ');
        if (!aiResponse.trim()) {
          aiResponse = 'Me conta mais sobre sua situação pra eu te ajudar melhor 😊';
        }
      }
    } else {
      console.log('✅ Transfer mention allowed (msg #' + context.botMessagesCount + ' >= ' + MIN_MESSAGES_BEFORE_TRANSFER + ')');
    }
  }

  // 6. Consumir energia - using the model that was actually used
  const energyResult = await checkAndConsumeEnergy(
    context.organizationId,
    bot.id,
    context.conversationId,
    tokensUsed,
    'ai_response',
    modelUsed
  );

  if (!energyResult.success) {
    // Sem energia, transferir para humano
    await transferToHuman(context.conversationId, 'no_energy', bot.transfer_message);
    
    if (bot.transfer_message) {
      // Tentar enviar mensagem de transferência mesmo sem energia
      await sendWhatsAppMessage(
        instanceName,
        context.chatId,
        bot.transfer_message,
        context.conversationId,
        context.instanceId,
        bot.id
      );
    }
    
    return { success: true, action: 'no_energy', message: 'No energy available' };
  }

  // 7. Decidir se responde com áudio ou texto
  let sent = false;
  let voiceEnergyConsumed = 0;
  
  // Só responde com áudio se o cliente mandou áudio (ou pela probabilidade antiga se quiser manter)
  const shouldSendAudio = bot.voice_enabled && 
    bot.audio_response_probability && 
    incomingMessageType === 'audio' && // Só responde em áudio se o cliente mandou áudio
    Math.random() * 100 < bot.audio_response_probability;
  
  if (shouldSendAudio && bot.voice_id) {
    console.log('🎤 Generating voice response...');
    
    try {
      // Call TTS edge function
      const ttsResponse = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          text: aiResponse,
          voiceId: bot.voice_id,
          organizationId: context.organizationId,
          botId: bot.id,
          conversationId: context.conversationId,
          voiceStyle: bot.voice_style || 'natural',
        }),
      });
      
      if (ttsResponse.ok) {
        const ttsData = await ttsResponse.json();
        
        if (ttsData.success && ttsData.audioUrl) {
          // Send audio message via Evolution API
          sent = await sendWhatsAppAudio(
            instanceName,
            context.chatId,
            ttsData.audioUrl,
            context.conversationId,
            context.instanceId,
            bot.id
          );
          
          voiceEnergyConsumed = ttsData.energyConsumed || 0;
          console.log('✅ Voice message sent, energy:', voiceEnergyConsumed);
        }
      }
      
      if (!sent) {
        console.log('⚠️ Voice failed, falling back to text');
      }
    } catch (error) {
      console.error('❌ Voice generation error:', error);
    }
  }
  
  // Fallback to text if voice failed or not enabled
  if (!sent) {
    sent = await sendWhatsAppMessage(
      instanceName,
      context.chatId,
      aiResponse,
      context.conversationId,
      context.instanceId,
      bot.id
    );
  }

  if (!sent) {
    return { success: false, action: 'error', message: 'Failed to send message' };
  }

  // 8. Enviar mídia de produto se identificado na MENSAGEM DO USUÁRIO (não na resposta)
  let mediaEnergyUsed = 0;
  try {
    const mediaResult = await sendProductMedia(
      bot,
      products,
      aiResponse,
      instanceName,
      context.chatId,
      context.conversationId,
      context.instanceId,
      userMessage // CRITICAL: Pass user message for product-scoped image resolution
    );
    
    // Consumir energia por cada mídia enviada (5 energia por imagem, 2 por link)
    if (mediaResult.imagesSent > 0 || mediaResult.linksSent > 0) {
      const mediaEnergy = (mediaResult.imagesSent * 5) + (mediaResult.linksSent * 2);
      const mediaEnergyResult = await checkAndConsumeEnergy(
        context.organizationId,
        bot.id,
        context.conversationId,
        mediaEnergy * 100, // tokens equivalentes
        'product_media',
        'media_sending'
      );
      if (mediaEnergyResult.success) {
        mediaEnergyUsed = mediaEnergyResult.energyConsumed;
      }
    }
  } catch (mediaError) {
    console.error('⚠️ Error sending product media (non-fatal):', mediaError);
  }

  // 9. Atualizar contadores da conversa
  const totalEnergy = energyResult.energyConsumed + voiceEnergyConsumed + mediaEnergyUsed;
  await supabase
    .from('whatsapp_conversations')
    .update({
      bot_messages_count: context.botMessagesCount + 1,
      bot_energy_consumed: context.botEnergyConsumed + totalEnergy,
    })
    .eq('id', context.conversationId);

  return { 
    success: true, 
    action: 'responded', 
    energyUsed: totalEnergy 
  };
}

// ============================================================================
// HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    const {
      botId,
      conversationId,
      instanceId,
      instanceName,
      organizationId,
      userMessage,
      contactName,
      phoneNumber,
      chatId,
      isFirstMessage,
      isReopened = false, // Nova flag - conversa reaberta (tinha histórico anterior)
      messageType = 'text',
      mediaUrl,
      mediaMimeType,
      isWithinSchedule = true,
    } = body;

    console.log('🤖 AI Bot Process request:', {
      botId,
      conversationId,
      isFirstMessage,
      isReopened,
      messageType,
      hasMedia: !!mediaUrl,
      isWithinSchedule,
      messagePreview: userMessage?.substring(0, 50)
    });

    // Validar inputs
    if (!botId || !conversationId) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar bot
    const { data: bot, error: botError } = await supabase
      .from('ai_bots')
      .select('*')
      .eq('id', botId)
      .eq('is_active', true)
      .single();

    if (botError || !bot) {
      console.error('❌ Bot not found or inactive:', botId);
      return new Response(JSON.stringify({ 
        error: 'Bot not found or inactive',
        success: false 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ======== VALIDAÇÃO: Bot está vinculado a esta instância? ========
    if (instanceId) {
      const { data: scheduleLink } = await supabase
        .from('instance_bot_schedules')
        .select('id, bot_id, team_id')
        .eq('instance_id', instanceId)
        .eq('is_active', true);

      if (scheduleLink && scheduleLink.length > 0) {
        const directLink = scheduleLink.some(s => s.bot_id === botId);
        
        if (!directLink) {
          const teamIds = scheduleLink.filter(s => s.team_id).map(s => s.team_id);
          let isTeamMember = false;
          
          if (teamIds.length > 0) {
            const { data: teamMembers } = await supabase
              .from('bot_team_members')
              .select('bot_id')
              .in('team_id', teamIds)
              .eq('bot_id', botId);
            
            isTeamMember = (teamMembers && teamMembers.length > 0);
            
            if (!isTeamMember) {
              const { data: teams } = await supabase
                .from('bot_teams')
                .select('id')
                .in('id', teamIds)
                .or(`initial_bot_id.eq.${botId},fallback_bot_id.eq.${botId}`);
              
              isTeamMember = (teams && teams.length > 0);
            }
          }
          
          if (!isTeamMember) {
            console.warn('⛔ Bot NOT linked to this instance:', { botId, instanceId });
            return new Response(JSON.stringify({ 
              error: 'Bot is not configured for this instance',
              success: false 
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }
      // If no schedules exist at all, allow (backward compatibility)
    }

    // Buscar dados da conversa
    const { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .select('bot_messages_count, bot_energy_consumed, lead_id, bot_qualification_step, bot_qualification_completed')
      .eq('id', conversationId)
      .single();

    const context: ConversationContext = {
      conversationId,
      instanceId,
      organizationId,
      contactName: contactName || 'Cliente',
      phoneNumber,
      chatId,
      botMessagesCount: conversation?.bot_messages_count || 0,
      botEnergyConsumed: conversation?.bot_energy_consumed || 0,
      leadId: conversation?.lead_id || null,
      qualificationStep: conversation?.bot_qualification_step || 0,
      qualificationCompleted: conversation?.bot_qualification_completed || false,
    };

    // WELCOME MESSAGE - APENAS para conversas genuinamente NOVAS
    // Proteção dupla: além do payload, valida no banco se o bot ainda não respondeu nada
    const shouldSendWelcome = Boolean(
      isFirstMessage &&
      !isReopened &&
      bot.welcome_message &&
      (context?.botMessagesCount || 0) === 0
    );

    if (shouldSendWelcome) {
      console.log('👋 Sending welcome message (genuinely new conversation)');
      await sendWhatsAppMessage(
        instanceName,
        chatId,
        bot.welcome_message,
        conversationId,
        instanceId,
        bot.id
      );
      
      // Consumir energia pelo welcome
      await checkAndConsumeEnergy(organizationId, bot.id, conversationId, 50, 'welcome_message');
      
      // Atualizar contadores
      await supabase
        .from('whatsapp_conversations')
        .update({
          bot_messages_count: (context?.botMessagesCount || 0) + 1,
        })
        .eq('id', conversationId);
      
      return new Response(JSON.stringify({ 
        success: true, 
        action: 'welcome_sent', 
        message: 'Welcome message sent, waiting for next user message' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Para conversas reabertas, logar e injetar guardrail no system prompt
    if (isReopened) {
      console.log('🔄 Reopened conversation - processing with AI using full conversation history (no welcome repeat)');
      // Append reopened conversation guardrails to system_prompt to prevent specialist repetition
      bot.system_prompt += `

═══ CONVERSA RETOMADA ═══
Este cliente VOLTOU a conversar. Ele já teve interação anterior.
REGRAS ABSOLUTAS para conversas retomadas:
1. NÃO repita boas-vindas ou apresentações que já foram feitas
2. NÃO prometa novamente "chamar especialista" ou "verificar com o time" se já disse isso antes
3. Se nas mensagens anteriores você mencionou especialista/time e ninguém veio, reconheça naturalmente e VOCÊ MESMA continue atendendo
4. Retome de onde parou, usando o histórico como contexto
5. Seja natural: "Oi de novo!" ou "Que bom que voltou!" é suficiente
═══════════════════════════`;
    }

    // Processar mensagem baseado no tipo
    let processedMessage = userMessage || '';
    let mediaProcessingEnergy = 0;

    // TRANSCRIÇÃO DE ÁUDIO
    if (messageType === 'audio' && mediaUrl) {
      console.log('🎤 Processing audio message...');
      
      try {
        const transcription = await transcribeAudio(mediaUrl);
        processedMessage = `[Áudio transcrito]: ${transcription.text}`;
        
        // Consumir energia pela transcrição
        const audioEnergy = await checkAndConsumeEnergy(
          organizationId, 
          botId, 
          conversationId, 
          transcription.tokensUsed, 
          'audio_transcription',
          'openai/whisper'
        );
        
        if (!audioEnergy.success) {
          console.log('⚡ No energy for audio transcription');
          return new Response(JSON.stringify({ 
            success: false, 
            action: 'no_energy', 
            message: 'No energy for audio transcription' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        mediaProcessingEnergy += audioEnergy.energyConsumed;
        console.log('✅ Audio transcribed and energy consumed:', audioEnergy.energyConsumed);
      } catch (audioError) {
        console.error('❌ Audio transcription failed:', audioError);
        processedMessage = '[Áudio não pôde ser transcrito. Por favor, digite sua mensagem.]';
      }
    }

    // ANÁLISE DE IMAGEM
    if (messageType === 'image' && mediaUrl) {
      console.log('🖼️ Processing image message...');
      
      try {
        // Buscar configurações da organização para modo médico de imagens
        const { data: orgSettings } = await supabase
          .from('organizations')
          .select('whatsapp_image_interpretation, whatsapp_image_medical_mode, ai_model_image')
          .eq('id', organizationId)
          .single();

        const useImageMedicalMode = orgSettings?.whatsapp_image_medical_mode ?? false;
        const imageInterpretationEnabled = orgSettings?.whatsapp_image_interpretation ?? false;
        const imageModel = (orgSettings as any)?.ai_model_image || 'google/gemini-2.5-flash';

        // Se a interpretação de imagem não está habilitada globalmente, pular
        if (!imageInterpretationEnabled) {
          console.log('📷 Image interpretation disabled globally, skipping analysis');
          processedMessage = userMessage || '[O cliente enviou uma imagem]';
        } else {
          console.log('📷 Image interpretation enabled, medical mode:', useImageMedicalMode, 'model:', imageModel);
          
          const imageAnalysis = await analyzeImage(mediaUrl, userMessage, bot.system_prompt, useImageMedicalMode, imageModel);
          
          // Para imagens, a resposta da análise já é a resposta do bot
          // Consumir energia pela análise
          const imageEnergy = await checkAndConsumeEnergy(
            organizationId, 
            botId, 
            conversationId, 
            imageAnalysis.tokensUsed, 
            useImageMedicalMode ? 'image_medical_turbo' : 'image_analysis',
            imageAnalysis.modelUsed
          );
          
          if (!imageEnergy.success) {
            console.log('⚡ No energy for image analysis');
            return new Response(JSON.stringify({ 
              success: false, 
              action: 'no_energy', 
              message: 'No energy for image analysis' 
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Enviar a resposta da análise de imagem diretamente
          const sent = await sendWhatsAppMessage(
            instanceName,
            chatId,
            imageAnalysis.text,
            conversationId,
            instanceId,
            botId
          );

          // Atualizar contadores
          await supabase
            .from('whatsapp_conversations')
            .update({
              bot_messages_count: context.botMessagesCount + 1,
              bot_energy_consumed: context.botEnergyConsumed + imageEnergy.energyConsumed,
            })
            .eq('id', conversationId);

          return new Response(JSON.stringify({ 
            success: sent, 
            action: 'responded', 
            energyUsed: imageEnergy.energyConsumed,
            messageType: 'image_analysis'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (imageError) {
        console.error('❌ Image analysis failed:', imageError);
        processedMessage = userMessage || 'O cliente enviou uma imagem que não pôde ser analisada.';
      }
    }

    // Se não tem mensagem para processar (ex: imagem sem texto após falha)
    if (!processedMessage) {
      return new Response(JSON.stringify({ 
        success: false, 
        action: 'error', 
        message: 'No message to process' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Processar mensagem (texto ou áudio transcrito)
    const result = await processMessage(bot, context, processedMessage, instanceName, isWithinSchedule, 0, messageType);

    // Adicionar energia de processamento de mídia ao resultado
    if (mediaProcessingEnergy > 0 && result.energyUsed) {
      result.energyUsed += mediaProcessingEnergy;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ AI Bot Process error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || "Erro no processamento do bot",
      success: false,
      action: 'error'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
