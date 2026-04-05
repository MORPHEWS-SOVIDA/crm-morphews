import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      name,
      serviceType,
      description,
      companyName,
      segment,
      products,
      targetAudience,
      mainObjection,
      tone,
      gender,
      presentName,
      qualificationStrategy,
      neverDo,
      transferReasons,
      useEmojis,
      responseLength,
      interpretAudio,
      interpretImages,
      interpretDocuments,
      voiceEnabled,
      voiceStyle,
      maxMessages,
      qualificationEnabled,
      qualificationQuestions,
      productScope,
      sendProductImages,
      sendProductVideos,
      sendProductLinks,
    } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const serviceLabels: Record<string, string> = {
      sales: "Vendas",
      support: "Suporte técnico / Pós-venda",
      sac: "SAC (atendimento ao cliente)",
      social_selling: "Social selling e relacionamento",
      qualification: "Qualificação de leads",
      scheduling: "Agendamento",
    };
    const serviceLabel = serviceLabels[serviceType] || serviceType;

    const systemPrompt = `Você é um especialista em prompt engineering para agentes de vendas e atendimento no WhatsApp.

Sua tarefa é gerar um system prompt completo, detalhado e expert-level para um agente de IA que vai atender clientes pelo WhatsApp.

O prompt gerado deve ter entre 2.500 e 4.000 caracteres e incluir obrigatoriamente estas seções:

1. IDENTIDADE — Nome, gênero, empresa, tom de voz, uso de emojis
2. MISSÃO — Objetivo principal do agente com clareza absoluta
3. CONTEXTO DO NEGÓCIO — Segmento, produtos/serviços, público-alvo
4. COMO ATENDER — Fluxo passo a passo de como conduzir a conversa
5. QUALIFICAÇÃO — Como entender o problema do cliente antes de oferecer solução
6. OBJEÇÕES — Como lidar com a principal objeção identificada
7. REGRAS CRÍTICAS — O que NUNCA fazer, formatado como lista clara
8. QUANDO TRANSFERIR PARA HUMANO — Condições exatas
9. ESTILO ANTI-ROBÔ — Exemplos de frases naturais vs frases robóticas
10. MEMÓRIA DE CONTEXTO — Instrução para nunca repetir perguntas já respondidas

Gere o prompt em português brasileiro. Seja específico, não genérico. Use as informações fornecidas para criar um agente que pareça um humano especialista, não um chatbot.

Retorne APENAS o texto do prompt, sem explicações, sem markdown de código, sem comentários adicionais.`;

    // Build transfer reasons string
    let transferReasonsStr = "";
    if (Array.isArray(transferReasons) && transferReasons.length > 0) {
      const reasonLabels: Record<string, string> = {
        explicit_request: "Cliente pediu explicitamente",
        serious_complaint: "Reclamação grave",
        after_attempts: "Após 2 tentativas sem resolver",
        refund: "Pedido de reembolso",
        never: "Nunca transferir",
      };
      transferReasonsStr = transferReasons.map((r: string) => reasonLabels[r] || r).join(", ");
    } else if (typeof transferReasons === "string") {
      transferReasonsStr = transferReasons;
    }

    const userMessage = `Crie um system prompt expert-level para este agente:

MISSÃO: ${serviceLabel}
NOME: ${name || "Não definido"}
EMPRESA: ${companyName || "Não informada"}
SEGMENTO: ${segment || "Não informado"}
PRODUTOS/SERVIÇOS: ${products || "Não informados"}
PÚBLICO-ALVO: ${targetAudience || "Não informado"}
PRINCIPAL OBJEÇÃO: ${mainObjection || "Não informada"}
TOM DE VOZ: ${tone || "casual"}
GÊNERO: ${gender || "neutro"}
USA EMOJIS: ${useEmojis === true ? "Sim" : useEmojis === false ? "Não" : "Sim"}
APRESENTA-SE COM NOME: ${presentName === true ? "Sim" : presentName === false ? "Não" : "Sim"}
PROCESSA ÁUDIO: ${interpretAudio ? "Sim" : "Não"}
PROCESSA IMAGENS: ${interpretImages ? "Sim" : "Não"}
ESTRATÉGIA DE QUALIFICAÇÃO: ${qualificationStrategy || "Não definida"}
NUNCA FAZER: ${neverDo || "Não definido"}
TRANSFERIR PARA HUMANO QUANDO: ${transferReasonsStr || "Cliente pedir explicitamente"}
LIMITE DE MENSAGENS: ${maxMessages || "Sem limite definido"}

${description ? `Contexto adicional: ${description}` : ""}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Erro ao gerar prompt com Claude: ${response.status}`);
    }

    const data = await response.json();
    const generatedPrompt = data.content?.[0]?.text;

    if (!generatedPrompt) {
      throw new Error("Claude não retornou um prompt válido");
    }

    return new Response(
      JSON.stringify({ prompt: generatedPrompt.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-bot-prompt error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
