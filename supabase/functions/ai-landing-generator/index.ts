import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
}

interface GeneratedContent {
  headline: string;
  subheadline: string;
  benefits: string[];
  urgencyText: string;
  guaranteeText: string;
  testimonials: { name: string; text: string }[];
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

    // Build the system prompt for high-conversion landing page copy
    const isWebinar = briefing.pageStyle === 'webinar';
    const isMinimal = briefing.pageStyle === 'minimal';
    
    const systemPrompt = `Você é um copywriter especialista em landing pages de alta conversão.
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
5. Depoimentos devem parecer autênticos (nomes comuns, textos naturais)
6. FAQ deve responder objeções reais de compra
${isWebinar ? '7. Para webinário: foque em curiosidade e FOMO, sem revelar demais' : ''}

Tom de voz: ${briefing.tone === 'professional' ? 'Profissional e confiável' : 
  briefing.tone === 'informal' ? 'Informal e próximo' : 
  briefing.tone === 'urgent' ? 'Urgente e direto' : 'Premium e exclusivo'}

Estilo visual sugerido: ${briefing.style === 'minimal' ? 'Cores: preto/branco com acento colorido' :
  briefing.style === 'bold' ? 'Cores vibrantes e contrastantes' :
  briefing.style === 'luxury' ? 'Cores: dourado, preto, branco' : 'Cores: verde, branco, tons naturais'}`;

    const userPrompt = `Crie uma landing page de alta conversão para:

PRODUTO: ${briefing.productName}
DESCRIÇÃO: ${briefing.productDescription}
PROMESSA PRINCIPAL: ${briefing.promise}
PÚBLICO-ALVO: ${briefing.targetAudience}
DIFERENCIAIS: ${briefing.differentials}
${briefing.ingredients ? `INGREDIENTES/COMPOSIÇÃO: ${briefing.ingredients}` : ''}
${briefing.salesScript ? `SCRIPT DE VENDAS (use como referência): ${briefing.salesScript}` : ''}
${briefing.previousFeedback ? `
⚠️ FEEDBACK DO USUÁRIO (versão anterior não agradou):
${briefing.previousFeedback}
Por favor, ajuste o conteúdo considerando esse feedback.` : ''}

Retorne um JSON com a seguinte estrutura:
{
  "headline": "string (máx 10 palavras, impactante)",
  "subheadline": "string (1-2 frases expandindo a promessa)",
  "benefits": ["array de 5-7 benefícios transformacionais"],
  "urgencyText": "string (texto de urgência/escassez)",
  "guaranteeText": "string (garantia convincente)",
  "testimonials": [
    {"name": "Nome Sobrenome", "text": "depoimento autêntico"},
    {"name": "Nome Sobrenome", "text": "depoimento autêntico"},
    {"name": "Nome Sobrenome", "text": "depoimento autêntico"}
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 2000,
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
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Falha ao processar resposta da IA. Tente novamente.");
    }

    // Calculate energy cost (tokens × 5 / 1000, minimum 300 for new, 150 for regen)
    const baseEnergy = Math.ceil((usage.total_tokens * 5) / 1000);
    const minimumEnergy = action === 'regenerate' ? 150 : 300;
    const energyCost = Math.max(baseEnergy, minimumEnergy);

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
