import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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



interface TestimonialConfig {
  count: number;
  style: 'review' | 'whatsapp';
  useRealPhotos: boolean;
  generateAudio: boolean;
  generateVideoAvatar: boolean;
}

interface GuaranteeConfig {
  enabled: boolean;
  days: number;
  text: string;
}

interface BriefingData {
  productName: string;
  productDescription: string;
  promise: string;
  targetAudience: string;
  differentials: string;
  tone: 'professional' | 'informal' | 'urgent' | 'premium';
  style: 'minimal' | 'bold' | 'luxury' | 'health';
  ingredients?: string;
  faq?: { question: string; answer: string }[];
  salesScript?: string;
  previousFeedback?: string;
  isRegeneration?: boolean;
  offerType?: string;
  pageStyle?: 'full' | 'minimal' | 'webinar';
  // New fields
  testimonialConfig?: TestimonialConfig;
  guaranteeConfig?: GuaranteeConfig;
  offers?: { quantity: number; label: string; price_cents: number }[];
}

interface WhatsAppMessage {
  id: string;
  text: string;
  isFromClient: boolean;
  timestamp: string;
  hasImage?: boolean;
}

interface GeneratedTestimonial {
  id: string;
  name: string;
  text: string;
  style: 'review' | 'whatsapp';
  whatsappMessages?: WhatsAppMessage[];
}

interface GeneratedContent {
  headline: string;
  subheadline: string;
  benefits: string[];
  urgencyText: string;
  guaranteeText: string;
  testimonials: GeneratedTestimonial[];
  faq: { question: string; answer: string }[];
  ctaText: string;
  primaryColor: string;
  estimatedTokens: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { briefing, action } = await req.json() as { 
      briefing: BriefingData; 
      action: 'generate' | 'regenerate';
    };

    const isRegeneration = action === 'regenerate' || !!briefing.isRegeneration;
    const hasFeedback = !!briefing.previousFeedback?.trim();

    console.log('[ai-landing-generator] request', {
      action,
      isRegeneration,
      hasFeedback,
      feedbackPreview: briefing.previousFeedback?.slice(0, 140) || null,
    });

    // Build the system prompt for high-conversion landing page copy
    const isWebinar = briefing.pageStyle === 'webinar';
    const isMinimal = briefing.pageStyle === 'minimal';
    const testimonialCount = briefing.testimonialConfig?.count || 3;
    const testimonialStyle = briefing.testimonialConfig?.style || 'review';
    const guaranteeDays = briefing.guaranteeConfig?.days || 30;
    
    let systemPrompt = `Você é um copywriter especialista em landing pages de alta conversão.
Seu objetivo é criar copy que VENDE. Você domina:
- Gatilhos mentais (escassez, urgência, prova social, autoridade)
- Estrutura AIDA (Atenção, Interesse, Desejo, Ação)
- Copywriting direto ao ponto, sem enrolação
- Headlines magnéticas que prendem atenção
- Benefícios transformadores (não features)

TIPO DE OFERTA: ${briefing.offerType || 'produto físico'}
${isWebinar ? 'ESTILO: Página de Webinário - CURTA, apenas headline, subheadline e CTA para inscrição' : ''}
${isMinimal ? 'ESTILO: Low Ticket - Página objetiva, poucos elementos, foco no CTA' : ''}

REGRAS IMPORTANTES:
1. Headline deve ter no MÁXIMO 10 palavras e ser impactante
2. Subheadline expande a promessa em 1-2 frases
3. Benefícios devem ser transformacionais (o que a pessoa GANHA, não o que o produto FAZ)
4. Urgência deve parecer real, não forçada
5. Depoimentos devem parecer autênticos (nomes comuns brasileiros, textos naturais)
6. FAQ deve responder objeções reais de compra
${isWebinar ? '7. Para webinário: foque em curiosidade e FOMO, sem revelar demais' : ''}

Tom de voz: ${briefing.tone === 'professional' ? 'Profissional e confiável' : 
  briefing.tone === 'informal' ? 'Informal e próximo' : 
  briefing.tone === 'urgent' ? 'Urgente e direto' : 'Premium e exclusivo'}

Estilo visual sugerido: ${briefing.style === 'minimal' ? 'Cores: preto/branco com acento colorido' :
  briefing.style === 'bold' ? 'Cores vibrantes e contrastantes' :
  briefing.style === 'luxury' ? 'Cores: dourado, preto, branco' : 'Cores: verde, branco, tons naturais'}

GARANTIA: ${guaranteeDays} dias
QUANTIDADE DE DEPOIMENTOS: ${testimonialCount}
ESTILO DOS DEPOIMENTOS: ${testimonialStyle === 'whatsapp' ? 'Conversa de WhatsApp (gere um array de mensagens simulando uma conversa real)' : 'Review tradicional (nome + texto)'}`;

    if (isRegeneration && hasFeedback) {
      systemPrompt += `\n\n⚠️ REGENERAÇÃO COM FEEDBACK DO USUÁRIO (OBRIGATÓRIO)\n`;
      systemPrompt += `O usuário não gostou da versão anterior e escreveu um feedback específico.\n`;
      systemPrompt += `Você DEVE priorizar esse feedback acima de qualquer outra instrução e realizar mudanças reais.\n`;
      systemPrompt += `Evite repetir a mesma headline, os mesmos benefícios e a mesma abordagem que poderiam ter causado rejeição.\n`;
      systemPrompt += `Se o feedback pedir mudança de tom, promessa, diferenciais, estrutura ou nível de especificidade, faça a alteração.\n`;
    }

    // Build testimonial structure based on style
    const testimonialStructure = testimonialStyle === 'whatsapp' 
      ? `{
        "id": "unique_id",
        "name": "Nome Completo",
        "text": "resumo curto do depoimento",
        "style": "whatsapp",
        "whatsappMessages": [
          {"id": "1", "text": "Oi, comprei o produto semana passada", "isFromClient": true, "timestamp": "10:30"},
          {"id": "2", "text": "E aí, o que achou?", "isFromClient": false, "timestamp": "10:31"},
          {"id": "3", "text": "AMEI! Já estou vendo resultados 😍", "isFromClient": true, "timestamp": "10:32"},
          {"id": "4", "text": "Sério? Me conta mais!", "isFromClient": false, "timestamp": "10:33"},
          {"id": "5", "text": "Já perdi 3kg em uma semana, sem passar fome!", "isFromClient": true, "timestamp": "10:35"}
        ]
      }`
      : `{"id": "unique_id", "name": "Nome Sobrenome", "text": "depoimento autêntico e natural", "style": "review"}`;

    const userPrompt = `${isRegeneration && hasFeedback ? `🔴 REGENERAÇÃO SOLICITADA\n\nFEEDBACK DO USUÁRIO (prioridade máxima):\n"""\n${briefing.previousFeedback}\n"""\n\nINSTRUÇÃO: Reescreva headline, subheadline e benefícios para endereçar diretamente o feedback.\nEvite repetir frases/ideias da versão anterior.\n\n` : ''}Crie uma landing page de alta conversão para:

PRODUTO: ${briefing.productName}
DESCRIÇÃO: ${briefing.productDescription}
PROMESSA PRINCIPAL: ${briefing.promise}
PÚBLICO-ALVO: ${briefing.targetAudience}
DIFERENCIAIS: ${briefing.differentials}
${briefing.ingredients ? `INGREDIENTES/COMPOSIÇÃO: ${briefing.ingredients}` : ''}
${briefing.salesScript ? `SCRIPT DE VENDAS (use como referência): ${briefing.salesScript}` : ''}
Retorne um JSON com a seguinte estrutura:
{
  "headline": "string (máx 10 palavras, impactante)",
  "subheadline": "string (1-2 frases expandindo a promessa)",
  "benefits": ["array de 5-7 benefícios transformacionais"],
  "urgencyText": "string (texto de urgência/escassez)",
  "guaranteeText": "string (garantia de ${guaranteeDays} dias, convincente)",
  "testimonials": [
    ${testimonialStructure}
    // Gere ${testimonialCount} depoimentos neste formato
  ],
  "faq": [
    {"question": "pergunta comum", "answer": "resposta objetiva"},
    {"question": "pergunta comum", "answer": "resposta objetiva"},
    {"question": "pergunta comum", "answer": "resposta objetiva"}
  ],
  "ctaText": "texto do botão de compra (ex: QUERO AGORA, GARANTIR O MEU)",
  "primaryColor": "cor hex sugerida baseada no estilo (ex: #10b981 para saúde)"
}

Retorne APENAS o JSON, sem markdown ou explicações.`;

    console.log("Calling Lovable AI for landing page generation...");
    console.log("Testimonial style:", testimonialStyle, "Count:", testimonialCount);

        model: _aiModel('google/gemini-2.5-flash'),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 3000, // Increased for WhatsApp style
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    const usage = aiResponse.usage || { total_tokens: 1500 };

    if (!content) {
      throw new Error("No content returned from AI");
    }

    // Parse the JSON response
    let generatedContent: GeneratedContent;
    try {
      // Clean the response (remove markdown code blocks if present)
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      generatedContent = JSON.parse(cleanContent);
      generatedContent.estimatedTokens = usage.total_tokens;
      
      // Ensure testimonials have the correct structure
      generatedContent.testimonials = generatedContent.testimonials.map((t, i) => ({
        id: t.id || `testimonial_${i + 1}`,
        name: t.name,
        text: t.text,
        style: t.style || testimonialStyle,
        whatsappMessages: t.whatsappMessages?.map((m, j) => ({
          ...m,
          id: m.id || `msg_${j + 1}`,
        })),
      }));
      
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Falha ao processar resposta da IA. Tente novamente.");
    }

    // Calculate energy cost
    const baseEnergy = Math.ceil((usage.total_tokens * 5) / 1000);
    const minimumEnergy = action === 'regenerate' ? 150 : 300;
    let energyCost = Math.max(baseEnergy, minimumEnergy);
    
    // Add extra cost for WhatsApp style (more complex generation)
    if (testimonialStyle === 'whatsapp') {
      energyCost += testimonialCount * 25; // 25 extra per WhatsApp testimonial
    }

    return new Response(
      JSON.stringify({
        success: true,
        content: generatedContent,
        energyCost,
        tokensUsed: usage.total_tokens,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("ai-landing-generator error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido ao gerar conteúdo" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
