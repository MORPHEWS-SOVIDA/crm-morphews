import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadContext {
  lead_id: string;
  lead_name: string;
  lead_whatsapp: string;
  created_at: string;
  stage_name: string | null;
  last_contact_at: string | null;
  whatsapp_summary: string;
  transcription_summary: string;
  standard_answers: string;
  product_answers: string;
  post_sale_info: string;
  sales_history: string;
  followup_history: string;
}

interface Suggestion {
  lead_id: string;
  lead_name: string;
  lead_whatsapp: string;
  reason: string;
  suggested_action: string;
  suggested_script: string;
  recommended_products?: string[];
  priority: 'high' | 'medium' | 'low';
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
        JSON.stringify({ error: "userId and organizationId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get seller's name from profiles table
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', userId)
      .maybeSingle();
    
    const sellerName = sellerProfile 
      ? `${sellerProfile.first_name || ''} ${sellerProfile.last_name || ''}`.trim() || 'Consultor'
      : 'Consultor';

    console.log(`📝 Seller name for suggestions: ${sellerName}`);

    // 1. Consume energy first
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
      console.error('Energy consumption error:', energyError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar energia" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const energyOk = typeof energyResult === 'boolean' ? energyResult : (energyResult?.success ?? true);
    if (!energyOk) {
      return new Response(
        JSON.stringify({ 
          error: "Energia insuficiente. Entre em contato com o administrador.",
          available_energy: energyResult?.available_energy,
          required_energy: ENERGY_COST
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`⚡ Energy consumed: ${ENERGY_COST} for ${type} suggestion`);

    // 2. Get IDs of pending suggestions already shown to this user
    const { data: existingSuggestions } = await supabase
      .from('ai_lead_suggestions')
      .select('lead_id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('suggestion_type', type)
      .eq('status', 'pending');
    
    const existingLeadIds = (existingSuggestions || []).map((s: any) => s.lead_id);
    const allExcludeIds = [...new Set([...excludeLeadIds, ...existingLeadIds])];

    // 3. Get candidate leads
    let leadsQuery = supabase
      .from('leads')
      .select(`
        id,
        name,
        whatsapp,
        created_at,
        stage
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(20);
    
    // Get funnel stages separately
    const { data: funnelStages } = await supabase
      .from('organization_funnel_stages')
      .select('enum_value, name')
      .eq('organization_id', organizationId);
    
    const stageNameMap = new Map<string, string>();
    (funnelStages || []).forEach((s: any) => {
      if (s.enum_value) stageNameMap.set(s.enum_value, s.name);
    });

    // Filter by responsible for followup
    if (type === 'followup') {
      const { data: responsibleLeads } = await supabase
        .from('lead_responsibles')
        .select('lead_id')
        .eq('user_id', userId);
      
      const responsibleLeadIds = (responsibleLeads || []).map(r => r.lead_id);
      
      if (responsibleLeadIds.length > 0) {
        leadsQuery = leadsQuery.in('id', responsibleLeadIds);
      }
    }

    // Exclude already shown leads
    if (allExcludeIds.length > 0) {
      leadsQuery = leadsQuery.not('id', 'in', `(${allExcludeIds.join(',')})`);
    }

    const { data: leads, error: leadsError } = await leadsQuery;
    
    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      throw leadsError;
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [], message: "Nenhum lead encontrado para análise" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Aggregate context for top leads
    const leadsToAnalyze = leads.slice(0, limit * 2);
    const leadContexts: LeadContext[] = [];

    for (const lead of leadsToAnalyze) {
      const leadWithStageName = {
        ...lead,
        funnel_stage: { name: stageNameMap.get(lead.stage) || lead.stage }
      };
      const context = await aggregateLeadContext(supabase, leadWithStageName, organizationId);
      leadContexts.push(context);
    }

    // 5. Generate suggestions with AI - include seller name instruction
    const systemPrompt = type === 'followup' 
      ? `Você é um assistente de vendas especializado em análise de leads. Analise o contexto dos leads e sugira os ${limit} melhores para follow-up AGORA.

Para cada lead, forneça:
- Motivo pelo qual deve ser contatado agora
- Ação sugerida (ligar, WhatsApp, etc.)
- Script de abordagem personalizado baseado no contexto

IMPORTANTE: No script, use o nome do vendedor "${sellerName}" para personalizar a mensagem. Por exemplo: "Olá, aqui é ${sellerName}..."

Priorize leads que:
1. Têm histórico de interesse demonstrado
2. Fizeram perguntas sobre produtos
3. Tiveram objeções que podem ser contornadas
4. Estão há tempo sem contato mas mostraram interesse

Retorne APENAS um JSON válido sem markdown:`
      : `Você é um especialista em recomendação de produtos. Analise o perfil e histórico de cada lead para recomendar produtos ideais.

Para cada lead, sugira até 3 produtos com base em:
- Respostas às perguntas de qualificação
- Histórico de conversas
- Produtos anteriormente comprados ou discutidos
- Perfil de necessidades identificado

IMPORTANTE: No script de abordagem, use o nome do vendedor "${sellerName}" para personalizar a mensagem.

Retorne APENAS um JSON válido sem markdown:`;

    const userPrompt = `Analise estes ${leadContexts.length} leads e retorne exatamente ${limit} sugestões:

${JSON.stringify(leadContexts, null, 2)}

Retorne um JSON com a estrutura:
{
  "suggestions": [
    {
      "lead_id": "uuid",
      "lead_name": "nome",
      "lead_whatsapp": "telefone",
      "reason": "Motivo da recomendação em 1-2 frases",
      "suggested_action": "ligar" | "whatsapp" | "agendar",
      "suggested_script": "Script personalizado de abordagem usando o nome do vendedor ${sellerName} (2-3 frases)",
      "recommended_products": ["Produto 1", "Produto 2"],
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI generation failed");
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || "";
    
    let suggestions: Suggestion[] = [];
    try {
      const jsonStr = content.replace(/```json?\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      suggestions = parsed.suggestions || [];
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError, content);
      // Fallback: return basic suggestions with seller name
      suggestions = leadContexts.slice(0, limit).map(ctx => ({
        lead_id: ctx.lead_id,
        lead_name: ctx.lead_name,
        lead_whatsapp: ctx.lead_whatsapp,
        reason: "Lead com potencial identificado",
        suggested_action: "whatsapp" as const,
        suggested_script: `Olá ${ctx.lead_name.split(' ')[0]}! Tudo bem? Aqui é ${sellerName}. Estou entrando em contato para saber como posso ajudá-lo(a).`,
        priority: "medium" as const,
      }));
    }

    const finalSuggestions = suggestions.slice(0, limit);

    // 6. Persist suggestions to database
    if (finalSuggestions.length > 0) {
      const suggestionsToInsert = finalSuggestions.map(s => ({
        organization_id: organizationId,
        user_id: userId,
        lead_id: s.lead_id,
        lead_name: s.lead_name,
        lead_whatsapp: s.lead_whatsapp || null,
        suggestion_type: type,
        reason: s.reason,
        suggested_action: s.suggested_action,
        suggested_script: s.suggested_script,
        recommended_products: s.recommended_products || null,
        priority: s.priority,
        status: 'pending',
        energy_consumed: Math.ceil(ENERGY_COST / finalSuggestions.length),
      }));

      const { error: insertError } = await supabase
        .from('ai_lead_suggestions')
        .insert(suggestionsToInsert);

      if (insertError) {
        console.error('Error saving suggestions:', insertError);
        // Don't fail the request, just log the error
      } else {
        console.log(`💾 Saved ${finalSuggestions.length} suggestions to database`);
      }
    }

    return new Response(
      JSON.stringify({ 
        suggestions: finalSuggestions,
        energyConsumed: ENERGY_COST,
      }),
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
  organizationId: string
): Promise<LeadContext> {
  const leadId = lead.id;

  // Get WhatsApp messages (last 10)
  const { data: conversations } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('lead_id', leadId)
    .limit(5);

  let whatsappSummary = "Sem histórico de WhatsApp";
  if (conversations && conversations.length > 0) {
    const convIds = (conversations as any[]).map((c: any) => c.id);
    const { data: messages } = await supabase
      .from('whatsapp_messages')
      .select('content, direction, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(15);

    if (messages && messages.length > 0) {
      const summary = (messages as any[]).reverse().map((m: any) => 
        `${m.direction === 'outgoing' ? 'Vendedor' : 'Cliente'}: ${m.content?.substring(0, 100) || '(mídia)'}`
      ).join('\n');
      whatsappSummary = summary.substring(0, 800);
    }
  }

  // Get transcriptions from receptive
  const { data: attendances } = await supabase
    .from('receptive_attendances')
    .select('transcription, call_quality_score, product_id')
    .eq('lead_id', leadId)
    .not('transcription', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2);

  let transcriptionSummary = "Sem transcrições de ligações";
  if (attendances && attendances.length > 0) {
    transcriptionSummary = (attendances as any[]).map((a: any) => {
      const score = a.call_quality_score as any;
      return `Transcrição: ${a.transcription?.substring(0, 300) || ''}... ${score?.summary ? `Resumo: ${score.summary}` : ''}`;
    }).join('\n').substring(0, 600);
  }

  // Get standard question answers
  const { data: standardAnswers } = await supabase
    .from('lead_standard_question_answers')
    .select(`
      selected_option_ids,
      numeric_value,
      imc_result,
      imc_category,
      question:standard_questions(question_text)
    `)
    .eq('lead_id', leadId)
    .limit(10);

  let standardAnswersSummary = "Sem respostas às perguntas padrão";
  if (standardAnswers && standardAnswers.length > 0) {
    const answers = (standardAnswers as any[]).map((a: any) => {
      const q = a.question?.question_text || 'Pergunta';
      let answer = '';
      if (a.imc_result) answer = `IMC: ${a.imc_result} (${a.imc_category})`;
      else if (a.numeric_value) answer = a.numeric_value.toString();
      else if (a.selected_option_ids?.length) answer = 'Opções selecionadas';
      return `${q}: ${answer}`;
    });
    standardAnswersSummary = answers.join('; ').substring(0, 400);
  }

  // Get product-specific answers
  const { data: productAnswers } = await supabase
    .from('lead_product_answers')
    .select(`
      answer_1,
      answer_2,
      answer_3,
      product:lead_products(name, key_question_1, key_question_2, key_question_3)
    `)
    .eq('lead_id', leadId)
    .limit(5);

  let productAnswersSummary = "Sem respostas de produtos";
  if (productAnswers && productAnswers.length > 0) {
    const answers = (productAnswers as any[]).map((pa: any) => {
      const p = pa.product;
      const parts: string[] = [];
      if (pa.answer_1 && p?.key_question_1) parts.push(`${p.key_question_1}: ${pa.answer_1}`);
      if (pa.answer_2 && p?.key_question_2) parts.push(`${p.key_question_2}: ${pa.answer_2}`);
      if (pa.answer_3 && p?.key_question_3) parts.push(`${p.key_question_3}: ${pa.answer_3}`);
      return `Produto ${p?.name}: ${parts.join(', ')}`;
    });
    productAnswersSummary = answers.join('; ').substring(0, 400);
  }

  // Get post-sale surveys
  const { data: surveys } = await supabase
    .from('post_sale_surveys')
    .select('received_order, knows_how_to_use, seller_rating, delivery_rating, notes')
    .eq('lead_id', leadId)
    .eq('status', 'completed')
    .limit(3);

  let postSaleInfo = "Sem histórico de pós-venda";
  if (surveys && surveys.length > 0) {
    const info = (surveys as any[]).map((s: any) => {
      const parts: string[] = [];
      if (s.received_order !== null) parts.push(`Recebeu: ${s.received_order ? 'Sim' : 'Não'}`);
      if (s.seller_rating) parts.push(`Avaliação vendedor: ${s.seller_rating}/5`);
      if (s.delivery_rating) parts.push(`Avaliação entrega: ${s.delivery_rating}/5`);
      if (s.notes) parts.push(`Obs: ${s.notes.substring(0, 100)}`);
      return parts.join(', ');
    });
    postSaleInfo = info.join(' | ').substring(0, 300);
  }

  // Get sales history
  const { data: sales } = await supabase
    .from('sales')
    .select('total_cents, status, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(5);

  let salesHistory = "Sem histórico de vendas";
  if (sales && sales.length > 0) {
    const salesArr = sales as any[];
    salesHistory = `${salesArr.length} venda(s). Total: R$ ${salesArr.reduce((acc: number, s: any) => acc + (s.total_cents || 0), 0) / 100}. Última: ${salesArr[0].created_at.split('T')[0]}`;
  }

  // Get followup history
  const { data: followups } = await supabase
    .from('lead_followups')
    .select('scheduled_at, result, notes')
    .eq('lead_id', leadId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(3);

  let followupHistory = "Sem follow-ups anteriores";
  if (followups && followups.length > 0) {
    const history = (followups as any[]).map((f: any) => 
      `${f.scheduled_at.split('T')[0]}: ${f.result || 'Sem resultado'} - ${f.notes?.substring(0, 50) || ''}`
    );
    followupHistory = history.join(' | ').substring(0, 300);
  }

  return {
    lead_id: leadId,
    lead_name: lead.name,
    lead_whatsapp: lead.whatsapp,
    created_at: lead.created_at,
    stage_name: lead.funnel_stage?.name || null,
    last_contact_at: null,
    whatsapp_summary: whatsappSummary,
    transcription_summary: transcriptionSummary,
    standard_answers: standardAnswersSummary,
    product_answers: productAnswersSummary,
    post_sale_info: postSaleInfo,
    sales_history: salesHistory,
    followup_history: followupHistory,
  };
}
