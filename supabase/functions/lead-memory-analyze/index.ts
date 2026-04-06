import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// AI PROVIDER: Gemini Direct (GEMINI_API_KEY) > Lovable Gateway (LOVABLE_API_KEY)
// ============================================================================
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const GEMINI_MODEL_MAP: Record<string, string> = {
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

function getAIConfig(model: string) {
  if (GEMINI_API_KEY) {
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      headers: { 'Authorization': `Bearer ${GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
      model: GEMINI_MODEL_MAP[model] || 'gemini-2.0-flash',
    };
  }
  const lk = Deno.env.get("LOVABLE_API_KEY") ?? "";
  return {
    url: getAIConfig('').url,
    headers: { 'Authorization': `Bearer ${lk}`, 'Content-Type': 'application/json' },
    model,
  };
}

function getEmbeddingConfig() {
  if (GEMINI_API_KEY) {
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/embeddings',
      headers: { 'Authorization': `Bearer ${GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
    };
  }
  const lk = Deno.env.get("LOVABLE_API_KEY") ?? "";
  return {
    url: getEmbeddingConfig().url,
    headers: { 'Authorization': `Bearer ${lk}`, 'Content-Type': 'application/json' },
  };
}



const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// INTERFACES
// ============================================================================

interface LeadPreference {
  preference_type: string;
  preference_key: string;
  preference_value: string;
  confidence_score: number;
}

interface ConversationSummary {
  summary_text: string;
  key_topics: string[];
  sentiment: string;
  action_items: string[];
  next_steps: string | null;
}

// ============================================================================
// ANALYZE CONVERSATION FOR PREFERENCES
// ============================================================================

async function analyzeConversationForPreferences(
  organizationId: string,
  leadId: string,
  conversationId: string,
  messages: Array<{ role: string; content: string }>
): Promise<LeadPreference[]> {
  if (messages.length < 3) {
    console.log('⏭️ Not enough messages to analyze preferences');
    return [];
  }

  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Atendente'}: ${m.content}`)
    .join('\n');

  const systemPrompt = `Você é um analista de comportamento do cliente. Analise a conversa e extraia preferências e características do cliente.

EXTRAIA as seguintes categorias de preferências:
- product_interest: Produtos ou categorias que o cliente demonstrou interesse
- communication_style: Estilo de comunicação preferido (formal, informal, direto, detalhista)
- budget_range: Faixa de orçamento mencionada ou inferida (baixo, médio, alto)
- timing: Urgência ou preferência de timing (urgente, planejado, sem pressa)
- concern: Preocupações ou objeções demonstradas
- health_goal: Objetivos de saúde mencionados
- lifestyle: Estilo de vida relevante

Para cada preferência identificada, forneça:
- preference_type: categoria (uma das acima)
- preference_key: identificador específico (ex: "interesse_emagrecimento", "estilo_informal")
- preference_value: descrição do valor (ex: "Cliente interessado em produtos para emagrecimento")
- confidence_score: confiança de 0.3 a 1.0

Retorne um JSON com array "preferences".`;

  try {
    const response = await fetch(getAIConfig('').url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analise esta conversa e extraia preferências:\n\n${conversationText}` }
        ],
        max_tokens: 1000,
        temperature: 0.3,
        tools: [{
          type: 'function',
          function: {
            name: 'save_preferences',
            description: 'Salva as preferências extraídas do cliente',
            parameters: {
              type: 'object',
              properties: {
                preferences: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      preference_type: { type: 'string' },
                      preference_key: { type: 'string' },
                      preference_value: { type: 'string' },
                      confidence_score: { type: 'number' }
                    },
                    required: ['preference_type', 'preference_key', 'preference_value', 'confidence_score']
                  }
                }
              },
              required: ['preferences']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'save_preferences' } }
      }),
    });

    if (!response.ok) {
      console.error('❌ AI analysis error:', response.status);
      return [];
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      return args.preferences || [];
    }

    return [];
  } catch (error) {
    console.error('❌ Error analyzing preferences:', error);
    return [];
  }
}

// ============================================================================
// GENERATE CONVERSATION SUMMARY
// ============================================================================

async function generateConversationSummary(
  messages: Array<{ role: string; content: string }>,
  contactName: string
): Promise<ConversationSummary | null> {
  if (messages.length < 5) {
    console.log('⏭️ Not enough messages for summary');
    return null;
  }

  const conversationText = messages
    .map(m => `${m.role === 'user' ? contactName : 'Atendente'}: ${m.content}`)
    .join('\n');

  const systemPrompt = `Você é um assistente que cria resumos executivos de conversas de atendimento.

Crie um resumo que permita a qualquer atendente entender rapidamente:
1. O que o cliente queria/precisa
2. O que foi discutido/oferecido
3. Qual o sentimento geral do cliente
4. Próximos passos acordados

Forneça:
- summary_text: Resumo em 2-4 frases
- key_topics: Array de tópicos principais (max 5)
- sentiment: "positive", "neutral" ou "negative"
- action_items: Array de ações pendentes (max 3)
- next_steps: Próximo passo acordado ou null`;

  try {
    const response = await fetch(getAIConfig('').url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Resuma esta conversa com ${contactName}:\n\n${conversationText}` }
        ],
        max_tokens: 500,
        temperature: 0.3,
        tools: [{
          type: 'function',
          function: {
            name: 'create_summary',
            description: 'Cria o resumo estruturado da conversa',
            parameters: {
              type: 'object',
              properties: {
                summary_text: { type: 'string' },
                key_topics: { type: 'array', items: { type: 'string' } },
                sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
                action_items: { type: 'array', items: { type: 'string' } },
                next_steps: { type: 'string' }
              },
              required: ['summary_text', 'key_topics', 'sentiment', 'action_items']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'create_summary' } }
      }),
    });

    if (!response.ok) {
      console.error('❌ Summary generation error:', response.status);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      return JSON.parse(toolCall.function.arguments);
    }

    return null;
  } catch (error) {
    console.error('❌ Error generating summary:', error);
    return null;
  }
}

// ============================================================================
// GENERATE SELLER BRIEFING
// ============================================================================

async function generateSellerBriefing(
  organizationId: string,
  leadId: string,
  contactName: string
): Promise<string> {
  // Buscar dados do lead
  const { data: lead } = await supabase
    .from('leads')
    .select('name, whatsapp, stars, funnel_stage_id, notes, created_at')
    .eq('id', leadId)
    .single();

  // Buscar preferências aprendidas
  const { data: preferences } = await supabase
    .from('lead_ai_preferences')
    .select('preference_type, preference_key, preference_value, confidence_score')
    .eq('lead_id', leadId)
    .order('confidence_score', { ascending: false })
    .limit(10);

  // Buscar últimos resumos de conversa
  const { data: summaries } = await supabase
    .from('lead_conversation_summaries')
    .select('summary_text, key_topics, sentiment, action_items, next_steps, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(3);

  // Buscar histórico de compras
  const { data: sales } = await supabase
    .from('sales')
    .select('id, total_value_cents, created_at, status')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Montar briefing
  const briefingParts: string[] = [];

  // Header
  briefingParts.push(`📋 *Briefing - ${contactName || lead?.name || 'Cliente'}*`);
  briefingParts.push('');

  // Info básica
  if (lead) {
    const stars = lead.stars ? '⭐'.repeat(lead.stars) : 'Não avaliado';
    briefingParts.push(`🌟 Classificação: ${stars}`);
    
    const daysSinceCreation = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24));
    briefingParts.push(`📅 Cliente há ${daysSinceCreation} dias`);
  }

  // Histórico de compras
  if (sales && sales.length > 0) {
    const completedSales = sales.filter(s => s.status === 'completed' || s.status === 'delivered');
    const totalSpent = completedSales.reduce((sum, s) => sum + (s.total_value_cents || 0), 0);
    briefingParts.push(`💰 Compras: ${completedSales.length} pedidos (R$ ${(totalSpent / 100).toFixed(2)} total)`);
  } else {
    briefingParts.push(`💰 Ainda não fez compras`);
  }

  briefingParts.push('');

  // Preferências aprendidas
  if (preferences && preferences.length > 0) {
    briefingParts.push('*🧠 O que a IA aprendeu:*');
    
    const grouped: Record<string, string[]> = {};
    for (const pref of preferences) {
      if (!grouped[pref.preference_type]) {
        grouped[pref.preference_type] = [];
      }
      grouped[pref.preference_type].push(pref.preference_value);
    }

    const typeLabels: Record<string, string> = {
      'product_interest': '🎯 Interesses',
      'health_goal': '💪 Objetivos',
      'concern': '⚠️ Preocupações',
      'budget_range': '💵 Orçamento',
      'communication_style': '💬 Estilo',
      'lifestyle': '🏃 Estilo de vida'
    };

    for (const [type, values] of Object.entries(grouped)) {
      const label = typeLabels[type] || type;
      briefingParts.push(`${label}: ${values.slice(0, 2).join('; ')}`);
    }
    briefingParts.push('');
  }

  // Último contato
  if (summaries && summaries.length > 0) {
    const lastSummary = summaries[0];
    const sentimentEmoji = lastSummary.sentiment === 'positive' ? '😊' : 
                           lastSummary.sentiment === 'negative' ? '😟' : '😐';
    
    briefingParts.push('*📝 Última conversa:*');
    briefingParts.push(`${sentimentEmoji} ${lastSummary.summary_text}`);
    
    if (lastSummary.next_steps) {
      briefingParts.push(`➡️ Próximo passo: ${lastSummary.next_steps}`);
    }
    
    if (lastSummary.action_items && lastSummary.action_items.length > 0) {
      briefingParts.push(`📌 Pendente: ${lastSummary.action_items[0]}`);
    }
  }

  // Notas do vendedor
  if (lead?.notes) {
    briefingParts.push('');
    briefingParts.push(`*📝 Notas:* ${lead.notes.substring(0, 100)}${lead.notes.length > 100 ? '...' : ''}`);
  }

  return briefingParts.join('\n');
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      action, 
      organizationId, 
      leadId, 
      conversationId, 
      contactName,
      messages 
    } = body;

    console.log('🧠 Lead Memory action:', action, { leadId, conversationId });

    // Action: analyze - Analisa conversa e extrai preferências + resumo
    if (action === 'analyze') {
      if (!organizationId || !leadId || !conversationId) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se aprendizado está habilitado globalmente
      const { data: orgSettings } = await supabase
        .from('organizations')
        .select('whatsapp_ai_learning_enabled')
        .eq('id', organizationId)
        .single();
      
      if (!(orgSettings as any)?.whatsapp_ai_learning_enabled) {
        console.log('🧠 AI Learning disabled globally, skipping analysis');
        return new Response(
          JSON.stringify({ success: true, message: 'Learning disabled for organization' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar mensagens da conversa
      const { data: dbMessages } = await supabase
        .from('whatsapp_messages')
        .select('content, direction, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (!dbMessages || dbMessages.length < 5) {
        return new Response(
          JSON.stringify({ success: true, message: 'Not enough messages to analyze' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const formattedMessages = dbMessages
        .filter(m => m.content)
        .map(m => ({
          role: m.direction === 'inbound' ? 'user' : 'assistant',
          content: m.content
        }));

      // Extrair preferências
      const preferences = await analyzeConversationForPreferences(
        organizationId,
        leadId,
        conversationId,
        formattedMessages
      );

      // Salvar/atualizar preferências
      for (const pref of preferences) {
        await supabase
          .from('lead_ai_preferences')
          .upsert({
            organization_id: organizationId,
            lead_id: leadId,
            preference_type: pref.preference_type,
            preference_key: pref.preference_key,
            preference_value: pref.preference_value,
            confidence_score: pref.confidence_score,
            last_observed_at: new Date().toISOString(),
            observation_count: 1
          }, {
            onConflict: 'organization_id,lead_id,preference_type,preference_key',
            ignoreDuplicates: false
          })
          .then(({ error }) => {
            if (error) console.error('Preference upsert error:', error);
          });
      }

      // Gerar resumo
      const summary = await generateConversationSummary(formattedMessages, contactName || 'Cliente');

      if (summary) {
        await supabase
          .from('lead_conversation_summaries')
          .insert({
            organization_id: organizationId,
            lead_id: leadId,
            conversation_id: conversationId,
            summary_text: summary.summary_text,
            key_topics: summary.key_topics,
            sentiment: summary.sentiment,
            action_items: summary.action_items,
            next_steps: summary.next_steps,
            energy_consumed: 50
          });
      }

      // Consumir energia
      await supabase.rpc('consume_energy', {
        p_organization_id: organizationId,
        p_bot_id: null,
        p_conversation_id: conversationId,
        p_action_type: 'lead_memory_analyze',
        p_energy_amount: 100,
        p_tokens_used: 1000,
        p_details: { preferences_found: preferences.length, summary_generated: !!summary }
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          preferences_extracted: preferences.length,
          summary_generated: !!summary
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: briefing - Gera briefing para o vendedor
    if (action === 'briefing') {
      if (!leadId) {
        return new Response(
          JSON.stringify({ error: 'Missing leadId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar organizationId do lead se não fornecido
      let resolvedOrgId = organizationId;
      if (!resolvedOrgId) {
        const { data: leadData } = await supabase
          .from('leads')
          .select('organization_id')
          .eq('id', leadId)
          .single();
        
        if (!leadData?.organization_id) {
          return new Response(
            JSON.stringify({ error: 'Lead not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        resolvedOrgId = leadData.organization_id;
      }

      console.log('📋 Generating seller briefing for lead:', leadId);

      const briefing = await generateSellerBriefing(resolvedOrgId, leadId, contactName || 'Cliente');

      console.log('📋 Briefing generated, length:', briefing.length);

      return new Response(
        JSON.stringify({ success: true, briefing }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: get_context - Retorna contexto para o bot usar
    if (action === 'get_context') {
      if (!organizationId || !leadId) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

      return new Response(
        JSON.stringify({ 
          success: true,
          context: {
            lead_name: lead?.name,
            lead_notes: lead?.notes,
            lead_stars: lead?.stars,
            preferences: preferences || [],
            last_summary: summaries?.[0] || null
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Lead Memory error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
