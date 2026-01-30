import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface PresetStep {
  step_number: number;
  delay_minutes: number;
  default_subject: string;
  default_html_template: string;
  variables: string[];
}

interface GenerateRequest {
  sequenceType: string;
  productName: string;
  niche: string;
  storeName: string;
  presets: PresetStep[];
}

/**
 * Generate personalized email sequences using AI
 * Consumes energy from organization balance
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: GenerateRequest = await req.json();
    const { sequenceType, productName, niche, storeName, presets } = body;

    console.log(`📧 Generating ${sequenceType} sequence for ${productName} (${niche})`);

    // Calculate energy cost (10 per email step)
    const energyCost = presets.length * 10;

    // Check energy balance
    const { data: org } = await supabase
      .from("organizations")
      .select("energy_balance")
      .eq("id", profile.organization_id)
      .single();

    if (!org || (org.energy_balance || 0) < energyCost) {
      return new Response(JSON.stringify({ 
        error: `Energia insuficiente. Necessário: ${energyCost}, Disponível: ${org?.energy_balance || 0}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate personalized content with AI
    const sequenceLabels: Record<string, string> = {
      abandoned_cart: "carrinho abandonado",
      post_purchase: "pós-compra",
      recompra: "recompra/reposição",
      welcome_lead: "boas-vindas para novos leads",
    };

    const sequenceStrategies: Record<string, string> = {
      abandoned_cart: `ESTRATÉGIA CARRINHO ABANDONADO:
- Email 1 (imediato): Tom amigável, lembrete sutil. "Esqueceu algo?" Destaque os produtos, crie curiosidade.
- Email 2 (1h): Urgência leve, benefícios do produto. Responda objeções comuns.
- Email 3 (3h): Escassez, prova social. "Outros estão comprando", estoque limitado.
- Email 4 (24h): Última chance, desconto exclusivo se aplicável. FOMO máximo.`,
      post_purchase: `ESTRATÉGIA PÓS-COMPRA:
- Email 1 (imediato): Confirmação calorosa, celebre a decisão. Reduza dissonância cognitiva.
- Email 2 (5min): Upsell inteligente, produtos complementares. "Quem comprou X também levou Y".
- Email 3 (24h): Informações de rastreio, expectativa sobre entrega, dicas de uso.`,
      recompra: `ESTRATÉGIA RECOMPRA:
- Email 1 (30 dias): Verificar satisfação, dica de uso avançado. Preparar terreno.
- Email 2 (90 dias): Lembrete de reposição, oferta especial para cliente fiel.`,
      welcome_lead: `ESTRATÉGIA BOAS-VINDAS:
- Email 1 (imediato): Apresentação calorosa, proposta de valor clara, primeiro benefício.
- Email 2 (24h): Conteúdo de valor, dica prática, construir autoridade.`,
    };

    const systemPrompt = `Você é um COPYWRITER BRASILEIRO especialista em e-mail marketing para e-commerce.
Você domina técnicas avançadas de persuasão: AIDA, PAS, storytelling, gatilhos mentais.

REGRAS DE OURO:
1. ASSUNTOS: Máximo 50 caracteres. Use números, perguntas, emojis estratégicos, curiosidade.
   Bons exemplos: "🛒 Você esqueceu isso aqui...", "Última chance: só até meia-noite", "Seu pedido está a caminho! 📦"
   
2. TOM E VOZ:
   - Saúde/Bem-estar: Profissional, empático, educativo
   - Beleza/Estética: Aspiracional, confiante, transformador
   - Suplementos/Fitness: Energético, motivacional, resultados
   - Moda: Elegante, exclusivo, tendências
   - Geral: Amigável, próximo, confiável

3. ESTRUTURA DO EMAIL:
   - Abertura que PRENDE (primeiros 2 segundos)
   - Corpo com benefícios claros (não features)
   - CTA único e irresistível
   - P.S. para reforçar urgência/benefício

4. GATILHOS MENTAIS:
   - Escassez: "Últimas unidades", "Oferta termina em X"
   - Prova social: "Milhares já experimentaram"
   - Reciprocidade: Ofereça algo de valor primeiro
   - Autoridade: Números, estudos, especialistas
   - Urgência: Deadlines claros e reais

5. HTML: Mantenha estrutura base, personalize APENAS textos. Variáveis: {{nome}}, {{produtos}}, {{valor}}, {{link_carrinho}}, {{link_rastreio}}

6. PERSONALIZAÇÃO: Use {{nome}} naturalmente, não force. Emails devem parecer escritos por humano.`;

    const userPrompt = `CRIE uma sequência de ${sequenceLabels[sequenceType] || sequenceType} ALTAMENTE PERSUASIVA para:

📦 PRODUTO: ${productName}
🎯 NICHO: ${niche}
🏪 LOJA: ${storeName}

${sequenceStrategies[sequenceType] || ''}

BASE A PERSONALIZAR (mantenha delays e estrutura HTML, melhore MUITO os textos):
${presets.map((p, i) => `
═══ E-mail ${i + 1} (envio: ${p.delay_minutes === 0 ? 'imediato' : p.delay_minutes < 60 ? p.delay_minutes + ' min' : p.delay_minutes < 1440 ? Math.floor(p.delay_minutes / 60) + 'h' : Math.floor(p.delay_minutes / 1440) + ' dias'}) ═══
Assunto atual: ${p.default_subject}
HTML base:
${p.default_html_template}
`).join('\n')}

RETORNE um JSON válido:
{
  "steps": [
    {
      "step_number": 1,
      "delay_minutes": 0,
      "default_subject": "Assunto MUITO melhor e persuasivo",
      "default_html_template": "HTML completo com textos TRANSFORMADOS",
      "variables": ["nome", "produtos", "valor", "link_carrinho"]
    }
  ]
}`;

    if (!LOVABLE_API_KEY) {
      console.warn("LOVABLE_API_KEY not configured, using default presets");
      return new Response(JSON.stringify({ steps: presets }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch(LOVABLE_AI_URL, {
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
        temperature: 0.85, // Increased for more creative outputs
        max_tokens: 8000, // Ensure full emails are generated
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI generation failed:", await aiResponse.text());
      // Fallback to presets
      return new Response(JSON.stringify({ steps: presets }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let personalizedSteps = presets;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() || content;
      const parsed = JSON.parse(jsonStr);
      
      if (parsed.steps && Array.isArray(parsed.steps)) {
        personalizedSteps = parsed.steps.map((step: PresetStep, idx: number) => ({
          ...presets[idx],
          ...step,
          step_number: step.step_number || idx + 1,
          delay_minutes: step.delay_minutes ?? presets[idx]?.delay_minutes ?? 0,
          variables: step.variables || presets[idx]?.variables || [],
        }));
      }
    } catch (e) {
      console.warn("Failed to parse AI response, using defaults:", e);
    }

    // Deduct energy
    await supabase
      .from("organizations")
      .update({ 
        energy_balance: (org.energy_balance || 0) - energyCost 
      })
      .eq("id", profile.organization_id);

    // Log energy usage
    await supabase.from("energy_transactions").insert({
      organization_id: profile.organization_id,
      amount: -energyCost,
      type: "debit",
      description: `Geração de sequência ${sequenceType} (${presets.length} e-mails)`,
      created_by: user.id,
    });

    console.log(`✅ Generated ${personalizedSteps.length} personalized emails, deducted ${energyCost} energy`);

    return new Response(JSON.stringify({ 
      steps: personalizedSteps,
      energy_cost: energyCost,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
