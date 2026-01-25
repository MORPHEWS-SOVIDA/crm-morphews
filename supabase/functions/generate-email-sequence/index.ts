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

    const systemPrompt = `Você é um especialista em email marketing para e-commerce brasileiro.
Sua tarefa é personalizar templates de email para o nicho e produto específico.

Regras:
- Mantenha a estrutura HTML base, apenas personalize textos
- Use linguagem persuasiva e emocional apropriada ao nicho
- Mantenha as variáveis ({{nome}}, {{produtos}}, etc.)
- Assuntos devem ter no máximo 50 caracteres
- Inclua emojis estratégicos nos assuntos
- O tom deve combinar com o nicho: saúde=profissional, beleza=aspiracional, suplementos=energético`;

    const userPrompt = `Personalize esta sequência de ${sequenceLabels[sequenceType] || sequenceType} para:

Produto: ${productName}
Nicho: ${niche}
Loja: ${storeName}

Templates base para personalizar:
${presets.map((p, i) => `
--- E-mail ${i + 1} (envio: ${p.delay_minutes === 0 ? 'imediato' : p.delay_minutes < 60 ? p.delay_minutes + ' min' : Math.floor(p.delay_minutes / 60) + 'h'}) ---
Assunto: ${p.default_subject}
HTML: ${p.default_html_template.substring(0, 500)}...
`).join('\n')}

Retorne um JSON com a estrutura:
{
  "steps": [
    {
      "step_number": 1,
      "delay_minutes": 0,
      "default_subject": "Assunto personalizado",
      "default_html_template": "HTML completo personalizado",
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
        temperature: 0.7,
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
