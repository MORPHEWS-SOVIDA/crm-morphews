import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { botId } = await req.json();
    if (!botId) {
      return new Response(JSON.stringify({ error: "botId is required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch bot details
    const { data: bot, error: botError } = await supabase
      .from("ai_bots")
      .select("name, system_prompt, service_type, personality_description, company_name, company_differential")
      .eq("id", botId)
      .single();

    if (botError || !bot) {
      return new Response(JSON.stringify({ error: "Bot not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

    const prompt = `Analise o prompt de sistema deste robô de atendimento e gere uma descrição de intenção para roteamento inteligente.

NOME DO ROBÔ: ${bot.name}
TIPO: ${bot.service_type || "geral"}
EMPRESA: ${bot.company_name || "não informada"}
DIFERENCIAL: ${bot.company_differential || "não informado"}
PERSONALIDADE: ${bot.personality_description || "não definida"}

PROMPT DE SISTEMA (resumo):
${(bot.system_prompt || "").substring(0, 1500)}

TAREFA:
Gere UMA frase descritiva de quando este robô deve ser ativado em um time. A frase deve ser:
- Clara e específica sobre o contexto de ativação
- Baseada nas capacidades e especialidades do robô
- Em português brasileiro

Exemplos de boas descrições:
- "Quando o cliente quer saber sobre manutenção de ar-condicionado"
- "Quando o cliente demonstra interesse em comprar produtos naturais"
- "Quando o cliente tem reclamação ou precisa de suporte técnico"

Responda APENAS com a frase descritiva, sem aspas, sem explicação extra.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You generate routing intent descriptions in Brazilian Portuguese. Be concise." },
          { role: "user", content: prompt },
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const suggestion = (data.choices?.[0]?.message?.content || "").trim();

    return new Response(JSON.stringify({ suggestion }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
