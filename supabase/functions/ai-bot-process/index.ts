import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";

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
    
    // Create form data for OpenAI Whisper
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'json');
    
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });
    
    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('❌ Whisper error:', whisperResponse.status, errorText);
      throw new Error(`Whisper error: ${whisperResponse.status}`);
    }
    
    const result = await whisperResponse.json();
    const transcribedText = result.text || '';
    
    console.log('✅ Audio transcribed:', transcribedText.substring(0, 100) + '...');
    
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

async function analyzeImage(mediaUrl: string, userMessage: string, botSystemPrompt: string): Promise<{ text: string; tokensUsed: number }> {
  console.log('🖼️ Analyzing image from:', mediaUrl);
  
  try {
    // Usar Gemini Flash via Lovable AI para análise de imagem
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `${botSystemPrompt}\n\nO cliente enviou uma imagem. Analise-a e responda de forma útil.`
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
                text: userMessage || 'O que você vê nesta imagem?'
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
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
    
    console.log('✅ Image analyzed:', analysisText.substring(0, 100) + '...');
    
    return { text: analysisText, tokensUsed };
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

  // Build query for products
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
      usage_period_days
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
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
  
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
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
// AI PROCESSING
// ============================================================================

async function getConversationHistory(conversationId: string, limit = 20): Promise<Array<{role: string, content: string}>> {
  const { data: messages } = await supabase
    .from('whatsapp_messages')
    .select('content, direction, is_from_bot, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!messages) return [];

  // Inverter para ordem cronológica e mapear para formato OpenAI
  return messages.reverse().map(msg => ({
    role: msg.direction === 'inbound' ? 'user' : 'assistant',
    content: msg.content || ''
  })).filter(m => m.content);
}

function buildBotPersonalityPrompt(bot: AIBot): string {
  const parts: string[] = [];
  
  // Identidade do robô
  if (bot.name) {
    parts.push(`Você é ${bot.name}.`);
  }
  
  // Gênero e idade
  if (bot.gender || bot.age_range) {
    const genderText = bot.gender === 'female' ? 'mulher' : bot.gender === 'male' ? 'homem' : 'pessoa';
    const ageText = bot.age_range ? ` de ${bot.age_range.replace('_', ' a ').replace('older', 'mais de')} anos` : '';
    parts.push(`Você é uma ${genderText}${ageText}.`);
  }
  
  // Localização e regionalismos
  if (bot.brazilian_state) {
    const stateNames: Record<string, string> = {
      'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia',
      'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás',
      'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais',
      'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí',
      'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul',
      'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo',
      'SE': 'Sergipe', 'TO': 'Tocantins'
    };
    const stateName = stateNames[bot.brazilian_state] || bot.brazilian_state;
    parts.push(`Você é de ${stateName} e usa expressões e sotaque típicos da região.`);
  }
  
  // Expressões regionais
  if (bot.regional_expressions && bot.regional_expressions.length > 0) {
    parts.push(`Use naturalmente expressões como: ${bot.regional_expressions.join(', ')}.`);
  }
  
  // Personalidade
  if (bot.personality_description) {
    parts.push(`Sua personalidade: ${bot.personality_description}`);
  }
  
  // Tipo de atendimento
  if (bot.service_type) {
    const serviceTypes: Record<string, string> = {
      'sales': 'Você é especialista em vendas consultivas. Foque em entender a necessidade e oferecer a melhor solução.',
      'support': 'Você foca em suporte e atendimento. Resolva dúvidas e problemas com empatia.',
      'scheduling': 'Você é especialista em agendamentos. Ajude a encontrar o melhor horário.',
      'general': 'Você oferece atendimento geral, adaptando-se à necessidade do cliente.'
    };
    parts.push(serviceTypes[bot.service_type] || '');
  }
  
  // Tamanho da resposta
  if (bot.response_length) {
    const lengthGuides: Record<string, string> = {
      'short': 'Seja BREVE e DIRETO. Respostas curtas de 1-2 frases quando possível.',
      'medium': 'Use respostas de tamanho médio, equilibradas entre brevidade e completude.',
      'long': 'Pode usar respostas mais detalhadas quando necessário explicar algo complexo.'
    };
    parts.push(lengthGuides[bot.response_length] || '');
  }
  
  // Diferencial da empresa
  if (bot.company_differential) {
    parts.push(`DIFERENCIAL DA EMPRESA: ${bot.company_differential}. Mencione isso quando relevante.`);
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
PERGUNTAS FREQUENTES (use para responder dúvidas comuns):
${faqText}`;
}

async function generateAIResponse(
  bot: AIBot, 
  userMessage: string, 
  conversationHistory: Array<{role: string, content: string}>,
  contactName: string,
  messageCount: number = 0,
  products: BotProduct[] = [],
  faqs: Array<{question: string, answer: string}> = []
): Promise<{ response: string; tokensUsed: number }> {
  
  // Construir prompt de personalidade
  const personalityPrompt = buildBotPersonalityPrompt(bot);
  
  // Contexto de produtos
  const productsContext = buildProductsContext(products);
  
  // Contexto de FAQs
  const faqContext = buildFAQContext(faqs);
  
  // Diretrizes de qualificação
  const qualificationInstructions = `
DIRETRIZES DE ATENDIMENTO HUMANIZADO:
1. Seja NATURAL - você é uma pessoa real, não um robô. Converse como se estivesse no WhatsApp.
2. NUNCA transfira nas primeiras mensagens - primeiro entenda o que o cliente precisa.
3. Faça perguntas para entender melhor. Demonstre interesse genuíno.
4. Se não souber algo específico, diga que vai verificar.
5. Use emojis com moderação para deixar a conversa mais leve.
6. Personalize: use o nome do cliente, referências ao que ele disse antes.

QUANDO TRANSFERIR:
- Cliente PEDIR explicitamente para falar com pessoa/humano/atendente
- Após 5+ trocas sobre o mesmo problema sem resolução
- Negociação de preço muito específica
- Reclamações graves

EVITE:
- Respostas genéricas tipo "Como posso ajudar?"
- Repetir as mesmas frases
- Ser formal demais - seja amigável!
- Transferir rápido demais`;

  // System prompt completo e rico
  const systemPrompt = `${personalityPrompt}

${bot.system_prompt || 'Você é um assistente de atendimento prestativo e empático.'}

CONTEXTO ATUAL:
- Cliente: ${contactName}
- Data/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
- Mensagens na conversa: ${messageCount}

${productsContext}

${faqContext}

${qualificationInstructions}

LEMBRE-SE: Você é um HUMANO conversando pelo WhatsApp. Seja natural, empático e útil.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-15),
    { role: 'user', content: userMessage }
  ];

  console.log('🤖 Calling Gemini with enriched context:', {
    hasProducts: products.length > 0,
    hasFAQs: faqs.length > 0,
    personality: !!personalityPrompt,
    messagesCount: messages.length
  });

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages,
      max_tokens: 600,
      temperature: 0.85, // Mais natural e variado
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Lovable AI error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('RATE_LIMITED');
    }
    if (response.status === 402) {
      throw new Error('PAYMENT_REQUIRED');
    }
    throw new Error(`AI_ERROR: ${response.status}`);
  }

  const data = await response.json();
  const aiResponse = data.choices?.[0]?.message?.content || '';
  const tokensUsed = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);

  console.log('✅ AI Response generated:', aiResponse.substring(0, 100) + '...');
  
  return { response: aiResponse, tokensUsed };
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

// ============================================================================
// ENERGY MANAGEMENT
// ============================================================================

async function checkAndConsumeEnergy(
  organizationId: string, 
  botId: string,
  conversationId: string,
  tokensUsed: number,
  actionType: string
): Promise<{ success: boolean; energyConsumed: number }> {
  // Calcular energia baseada em tokens (1 energia = ~100 tokens)
  const energyToConsume = Math.max(1, Math.ceil(tokensUsed / 100));

  // Consumir energia via RPC (também registra metadados/uso no backend)
  const { data, error } = await supabase.rpc('consume_energy', {
    p_organization_id: organizationId,
    p_bot_id: botId,
    p_conversation_id: conversationId,
    p_action_type: actionType,
    p_energy_amount: energyToConsume,
    p_tokens_used: tokensUsed,
    p_details: { timestamp: new Date().toISOString() },
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

  console.log('⚡ Energy consumed:', energyToConsume);
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
  isWithinSchedule: boolean = true // Novo parâmetro - vem do webhook
): Promise<ProcessResult> {
  
  console.log('🤖 Processing message for bot:', bot.name);
  
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

  // 2. Verificar keywords de transferência
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

  // 3. Verificar limite de mensagens - aumentado para dar mais tempo ao robô qualificar
  // Mínimo de 5 mensagens antes de transferir por limite
  const effectiveMaxMessages = bot.max_messages_before_transfer 
    ? Math.max(bot.max_messages_before_transfer, 5) 
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
  const [products, faqs] = await Promise.all([
    getBotProducts(bot.id, context.organizationId, productScope),
    getBotKnowledge(bot.id)
  ]);
  
  console.log('📦 Bot context loaded:', { products: products.length, faqs: faqs.length });

  // 6. Gerar resposta IA com contexto completo
  let aiResponse: string;
  let tokensUsed: number;
  
  try {
    const result = await generateAIResponse(
      bot, 
      userMessage, 
      conversationHistory, 
      context.contactName, 
      context.botMessagesCount,
      products,
      faqs
    );
    aiResponse = result.response;
    tokensUsed = result.tokensUsed;
  } catch (error: any) {
    console.error('❌ AI generation error:', error.message);
    
    if (error.message === 'RATE_LIMITED' || error.message === 'PAYMENT_REQUIRED') {
      // Transferir para humano se sem créditos
      await transferToHuman(context.conversationId, 'no_credits', bot.transfer_message);
      return { success: false, action: 'no_energy', message: error.message };
    }
    
    return { success: false, action: 'error', message: error.message };
  }

  // 6. Consumir energia
  const energyResult = await checkAndConsumeEnergy(
    context.organizationId,
    bot.id,
    context.conversationId,
    tokensUsed,
    'ai_response'
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

  // 7. Enviar resposta
  const sent = await sendWhatsAppMessage(
    instanceName,
    context.chatId,
    aiResponse,
    context.conversationId,
    context.instanceId,
    bot.id
  );

  if (!sent) {
    return { success: false, action: 'error', message: 'Failed to send message' };
  }

  // 8. Atualizar contadores da conversa
  await supabase
    .from('whatsapp_conversations')
    .update({
      bot_messages_count: context.botMessagesCount + 1,
      bot_energy_consumed: context.botEnergyConsumed + energyResult.energyConsumed,
    })
    .eq('id', context.conversationId);

  return { 
    success: true, 
    action: 'responded', 
    energyUsed: energyResult.energyConsumed 
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
      messageType = 'text',
      mediaUrl,
      mediaMimeType,
      isWithinSchedule = true, // Novo campo do webhook - indica se está dentro do horário agendado
    } = body;

    console.log('🤖 AI Bot Process request:', {
      botId,
      conversationId,
      isFirstMessage,
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

    // Se é primeira mensagem e tem welcome message, enviar primeiro
    if (isFirstMessage && bot.welcome_message) {
      console.log('👋 Sending welcome message');
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
          'audio_transcription'
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
        const imageAnalysis = await analyzeImage(mediaUrl, userMessage, bot.system_prompt);
        
        // Para imagens, a resposta da análise já é a resposta do bot
        // Consumir energia pela análise
        const imageEnergy = await checkAndConsumeEnergy(
          organizationId, 
          botId, 
          conversationId, 
          imageAnalysis.tokensUsed, 
          'image_analysis'
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
    const result = await processMessage(bot, context, processedMessage, instanceName, isWithinSchedule);

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
      error: error.message,
      success: false,
      action: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
