import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const _LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

function _aiUrl() {
  return GEMINI_API_KEY
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    : 'https://ai.gateway.lovable.dev/v1/chat/completions';
}
function _aiHeaders() {
  const key = GEMINI_API_KEY || _LOVABLE_KEY;
  return { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
}
function _aiModel() {
  return GEMINI_API_KEY ? 'gemini-2.5-flash' : 'google/gemini-2.5-flash';
}

interface LeadContext {
  lead_id: string;
  lead_name: string;
  lead_whatsapp: string;
  created_at: string;
  stage_name: string | null;
  days_inactive: number;
  has_purchases: boolean;
  total_spent: number;
  last_purchase_date: string | null;
  whatsapp_summary: string;
  sales_history: string;
  followup_history: string;
  preferences_summary: string;
  conversation_summaries: string;
}

interface IntelligenceRequest {
  type: 'followup' | 'products';
  userId: string;
  organizationId: string;
  excludeLeadIds?: string[];
  limit?: number;
}

const ENERGY_COST = 30;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, userId, organizationId, excludeLeadIds = [], limit = 3 }: IntelligenceRequest = await req.json();

    if (!userId || !organizationId) {
      return new Response(
        JSON.stringify({ error: "userId and organizationId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get seller name
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', userId)
      .maybeSingle();
    const sellerName = sellerProfile 
      ? `${sellerProfile.first_name || ''} ${sellerProfile.last_name || ''}`.trim() || 'Consultor'
      : 'Consultor';
    console.log(`📝 Seller: ${sellerName}`);

    // Consume energy
    const { data: energyResult, error: energyError } = await supabase.rpc('consume_energy', {
      p_organization_id: organizationId,
      p_bot_id: null,
      p_conversation_id: null,
      p_action_type: type === 'followup' ? 'ai_followup_suggestion' : 'ai_product_recommendation',
      p_energy_amount: ENERGY_COST,
      p_tokens_used: null,
      p_details: { user_id: userId, type, timestamp: new Date().toISOString() },
    });

    if (energyError) {
      console.error('Energy error:', energyError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar energia" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const energyOk = typeof energyResult === 'boolean' ? energyResult : (energyResult?.success ?? true);
    if (!energyOk) {
      return new Response(
        JSON.stringify({ error: "Energia insuficiente.", available_energy: energyResult?.available_energy, required_energy: ENERGY_COST }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing pending suggestions to exclude
    const { data: existingSuggestions } = await supabase
      .from('ai_lead_suggestions')
      .select('lead_id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('suggestion_type', type)
      .eq('status', 'pending');
    
    const existingLeadIds = (existingSuggestions || []).map((s: any) => s.lead_id);
    const allExcludeIds = [...new Set([...excludeLeadIds, ...existingLeadIds])];

    // Get funnel stages map (by id AND enum_value)
    const { data: funnelStages } = await supabase
      .from('organization_funnel_stages')
      .select('id, enum_value, name, stage_type, position')
      .eq('organization_id', organizationId);
    
    const stageMapById = new Map<string, any>();
    const stageMapByEnum = new Map<string, string>();
    (funnelStages || []).forEach((s: any) => {
      stageMapById.set(s.id, s);
      if (s.enum_value) stageMapByEnum.set(s.enum_value, s.name);
    });

    // Get ALL candidate leads including closed/won stages
    let leadsQuery = supabase
      .from('leads')
      .select('id, name, whatsapp, created_at, updated_at, funnel_stage_id, stage, stars, observations')
      .eq('organization_id', organizationId)
      .not('whatsapp', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(40);

    if (allExcludeIds.length > 0) {
      leadsQuery = leadsQuery.not('id', 'in', `(${allExcludeIds.join(',')})`);
    }

    // For followup, filter by responsible
    if (type === 'followup') {
      const { data: responsibleLeads } = await supabase
        .from('lead_responsibles')
        .select('lead_id')
        .eq('user_id', userId);
      
      const myLeadIds = (responsibleLeads || []).map((r: any) => r.lead_id);
      if (myLeadIds.length > 0) {
        leadsQuery = leadsQuery.in('id', myLeadIds);
      }
    }

    const { data: leads, error: leadsError } = await leadsQuery;
    if (leadsError) throw leadsError;

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [], message: "Nenhum lead encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📊 Found ${leads.length} candidate leads`);

    // Score leads by opportunity
    const scoredLeads = leads.map((lead: any) => {
      // Resolve stage name from funnel_stage_id or stage enum
      const stageById = stageMapById.get(lead.funnel_stage_id);
      const stageByEnum = stageMapByEnum.get(lead.stage);
      const stageName = stageById?.name || stageByEnum || lead.stage || 'Desconhecido';
      
      const daysSinceUpdate = Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      
      let score = 0;
      if (daysSinceUpdate >= 2 && daysSinceUpdate < 7) score += 50; // slipping
      if (daysSinceUpdate >= 7 && daysSinceUpdate < 14) score += 40;
      if (daysSinceUpdate < 2) score += 20; // fresh
      if (daysSinceUpdate >= 14 && daysSinceUpdate < 60) score += 35; // reactivation
      if (daysSinceUpdate >= 60) score += 25;
      if (lead.stars >= 3) score += 15;
      
      return { ...lead, stage_name: stageName, days_inactive: daysSinceUpdate, score };
    });

    scoredLeads.sort((a: any, b: any) => b.score - a.score);
    const topLeads = scoredLeads.slice(0, Math.min(limit * 3, 9));

    // Aggregate context in parallel
    const leadContexts = await Promise.all(
      topLeads.map((lead: any) => aggregateLeadContext(supabase, lead, organizationId))
    );

    console.log(`🧠 Context for ${leadContexts.length} leads`);

    // Generate suggestions with AI
    const systemPrompt = type === 'followup' 
      ? `Você é um assistente de vendas brasileiro especialista em reengajamento. Sugira os ${limit} melhores leads para contato AGORA.

REGRAS:
- Leads COM compra anterior: sugira reativação, novo ciclo, upsell
- Leads SEM compra mas com interesse: sugira retomada
- Leads inativos: sugira reengajamento com gatilho emocional
- Leads em "pós-venda" ou "compra finalizada": ÓTIMOS para recompra!
- Use "${sellerName}" no script
- Script CURTO (2-3 frases), HUMANO, estilo WhatsApp
- NUNCA robótico. Soa como amigo que lembrou do cliente.

Retorne APENAS JSON válido sem markdown e sem \`\`\`:`
      : `Você é especialista em recomendação de produtos de saúde/bem-estar. Sugira produtos ideais para cada lead.

REGRAS:
- Baseie-se no histórico de compras e conversas
- Para quem já comprou: sugira complementares ou reposição
- Use "${sellerName}" no script
- Script CURTO e HUMANO

Retorne APENAS JSON válido sem markdown e sem \`\`\`:`;

    const userPrompt = `Analise estes ${leadContexts.length} leads e retorne exatamente ${limit} sugestões:

${JSON.stringify(leadContexts, null, 2)}

JSON esperado:
{
  "suggestions": [
    {
      "lead_id": "uuid-do-lead",
      "lead_name": "nome",
      "lead_whatsapp": "telefone",
      "reason": "Motivo em 1-2 frases",
      "suggested_action": "whatsapp",
      "suggested_script": "Mensagem curta usando ${sellerName}",
      "recommended_products": ["Produto 1"],
      "priority": "high"
    }
  ]
}`;

    // Try primary AI, fallback to Lovable Gateway
    let aiResponse = await fetch(_aiUrl(), {
      method: "POST",
      headers: _aiHeaders(),
      body: JSON.stringify({
        model: _aiModel(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    // Fallback to Lovable Gateway if Gemini fails
    if (!aiResponse.ok && GEMINI_API_KEY && _LOVABLE_KEY) {
      console.warn(`⚠️ Primary AI failed (${aiResponse.status}), trying Lovable Gateway fallback`);
      aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: "POST",
        headers: { 'Authorization': `Bearer ${_LOVABLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições. Tente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";
    console.log(`🤖 AI raw response (first 500 chars): ${rawContent.substring(0, 500)}`);
    
    let parsed: any;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('❌ No JSON found in AI response');
      }
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { suggestions: [] };
      console.log(`📋 Parsed ${(parsed.suggestions || []).length} suggestions from AI`);
    } catch {
      console.error('Parse error:', rawContent.substring(0, 500));
      // Fallback suggestions
      parsed = {
        suggestions: topLeads.slice(0, limit).map((l: any) => ({
          lead_id: l.id,
          lead_name: l.name,
          lead_whatsapp: l.whatsapp,
          reason: `Lead inativo há ${l.days_inactive} dias - oportunidade de reengajamento`,
          suggested_action: 'whatsapp',
          suggested_script: `Oi ${l.name.split(' ')[0]}! Aqui é ${sellerName}. Tudo bem? Lembrei de você e queria saber se posso te ajudar com algo 😊`,
          priority: l.days_inactive > 7 ? 'high' : 'medium',
        })),
      };
    }

    const suggestions = (parsed.suggestions || []).slice(0, limit);

    // Validate lead_ids
    const validLeadIds = new Set(topLeads.map((l: any) => l.id));
    const validSuggestions = suggestions.filter((s: any) => {
      if (!validLeadIds.has(s.lead_id)) {
        console.warn(`⚠️ Invalid lead_id from AI: ${s.lead_id}`);
        return false;
      }
      return s.lead_name && s.reason && s.suggested_script;
    });

    console.log(`✅ ${validSuggestions.length} valid suggestions`);

    // Persist
    if (validSuggestions.length > 0) {
      const rows = validSuggestions.map((s: any) => ({
        lead_id: s.lead_id,
        lead_name: s.lead_name,
        lead_whatsapp: s.lead_whatsapp || '',
        reason: s.reason,
        suggested_action: s.suggested_action || 'whatsapp',
        suggested_script: s.suggested_script,
        recommended_products: s.recommended_products || [],
        priority: s.priority || 'medium',
        suggestion_type: type,
        organization_id: organizationId,
        user_id: userId,
        status: 'pending',
        energy_consumed: Math.ceil(ENERGY_COST / validSuggestions.length),
      }));

      const { error: insertError } = await supabase
        .from('ai_lead_suggestions')
        .insert(rows);

      if (insertError) console.error('Insert error:', insertError);
      else console.log(`💾 Saved ${rows.length} suggestions`);
    }

    return new Response(
      JSON.stringify({ suggestions: validSuggestions, energyConsumed: ENERGY_COST }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Lead intelligence error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function aggregateLeadContext(
  supabase: any,
  lead: any,
  _organizationId: string
): Promise<LeadContext> {
  const leadId = lead.id;

  const [convRes, salesRes, followupsRes, prefsRes, summariesRes] = await Promise.all([
    supabase
      .from('whatsapp_conversations')
      .select('id, status, updated_at')
      .eq('lead_id', leadId)
      .order('updated_at', { ascending: false })
      .limit(3),
    supabase
      .from('sales')
      .select('total_cents, status, created_at, payment_method')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('lead_followups')
      .select('scheduled_at, result, notes, completed_at')
      .eq('lead_id', leadId)
      .order('scheduled_at', { ascending: false })
      .limit(3),
    supabase
      .from('lead_ai_preferences')
      .select('preference_type, preference_key, preference_value, confidence_score')
      .eq('lead_id', leadId)
      .order('confidence_score', { ascending: false })
      .limit(10),
    supabase
      .from('lead_conversation_summaries')
      .select('summary_text, key_topics, sentiment, next_steps')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  // WhatsApp messages
  let whatsappSummary = "Sem histórico WhatsApp";
  const convs = convRes.data || [];
  if (convs.length > 0) {
    const { data: messages } = await supabase
      .from('whatsapp_messages')
      .select('content, direction, created_at')
      .in('conversation_id', convs.map((c: any) => c.id))
      .order('created_at', { ascending: false })
      .limit(10);

    if (messages && messages.length > 0) {
      whatsappSummary = messages.reverse().map((m: any) =>
        `${m.direction === 'outgoing' ? 'Vendedor' : 'Cliente'}: ${(m.content || '(mídia)').substring(0, 80)}`
      ).join('\n').substring(0, 600);
    }
  }

  // Sales
  const sales = salesRes.data || [];
  const completedSales = sales.filter((s: any) => ['completed', 'delivered', 'closed', 'finalized'].includes(s.status));
  const totalSpent = completedSales.reduce((sum: number, s: any) => sum + (s.total_cents || 0), 0);
  const salesHistory = sales.length > 0
    ? `${completedSales.length} compra(s). Total: R$ ${(totalSpent / 100).toFixed(2)}. Última: ${sales[0].created_at?.split('T')[0] || 'N/A'}`
    : "Sem compras";

  // Followups
  const followups = followupsRes.data || [];
  const followupHistory = followups.length > 0
    ? followups.map((f: any) =>
        `${f.scheduled_at?.split('T')[0]}: ${f.result || (f.completed_at ? 'OK' : 'Pendente')} ${f.notes ? '- ' + f.notes.substring(0, 50) : ''}`
      ).join(' | ').substring(0, 300)
    : "Sem follow-ups";

  // Preferences
  const prefs = prefsRes.data || [];
  const prefsSummary = prefs.length > 0
    ? prefs.map((p: any) => `${p.preference_key}: ${p.preference_value}`).join(', ').substring(0, 300)
    : "Sem preferências";

  // Summaries
  const summaries = summariesRes.data || [];
  const convSummaries = summaries.length > 0
    ? summaries.map((s: any) => {
        const topics = Array.isArray(s.key_topics) ? s.key_topics.join(', ') : '';
        return `${s.summary_text?.substring(0, 150) || ''} [${s.sentiment || ''}] ${topics}`;
      }).join(' | ').substring(0, 500)
    : "Sem resumos";

  return {
    lead_id: leadId,
    lead_name: lead.name || 'Sem nome',
    lead_whatsapp: lead.whatsapp || '',
    created_at: lead.created_at,
    stage_name: lead.stage_name,
    days_inactive: lead.days_inactive || 0,
    has_purchases: completedSales.length > 0,
    total_spent: totalSpent / 100,
    last_purchase_date: completedSales.length > 0 ? completedSales[0].created_at?.split('T')[0] : null,
    whatsapp_summary: whatsappSummary,
    sales_history: salesHistory,
    followup_history: followupHistory,
    preferences_summary: prefsSummary,
    conversation_summaries: convSummaries,
  };
}
