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
    const body = await req.json();
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
    } = body;

    // Try Anthropic first, fallback to Lovable AI Gateway
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!ANTHROPIC_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("Nenhuma chave de IA configurada (ANTHROPIC_API_KEY ou LOVABLE_API_KEY)");
    }

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
7. REGRAS CRÍTICAS — O que NUNCA fazer, formatado como lista clara. OBRIGATORIAMENTE inclua: "NUNCA invente informações, dados, preços, especificações ou qualquer fato que não esteja na sua base de conhecimento. Se não sabe, diga que vai verificar."
8. QUANDO TRANSFERIR PARA HUMANO — Condições exatas
9. ESTILO ANTI-ROBÔ — Exemplos de frases naturais vs frases robóticas
10. MEMÓRIA DE CONTEXTO — Instrução para nunca repetir perguntas já respondidas

REGRAS CRÍTICAS QUE VOCÊ DEVE RESPEITAR NO PROMPT GERADO:
- O TOM DE VOZ informado pelo usuário é OBRIGATÓRIO. Se ele informou "formal", o prompt DEVE instruir o agente a usar linguagem formal. Se "casual", use casual. NÃO altere o tom escolhido pelo usuário.
- O LIMITE DE MENSAGENS informado é OBRIGATÓRIO. Use EXATAMENTE o número informado, não arredonde nem altere.
- Instrua o agente a enviar UMA pergunta por mensagem (nunca múltiplas perguntas de uma vez)
- Instrua o agente a NUNCA repetir a saudação se o lead já iniciou a conversa
- Instrua o agente a adaptar o comprimento da resposta ao contexto (respostas curtas para perguntas simples)
- Se o agente processa áudios, inclua instrução para responder de forma natural ao conteúdo transcrito
- Se o agente processa imagens, inclua instrução para descrever o que vê e agir conforme contexto

Gere o prompt em português brasileiro. Seja específico, não genérico. Use as informações fornecidas para criar um agente que pareça um humano especialista, não um chatbot.

Retorne APENAS o texto do prompt, sem explicações, sem markdown de código, sem comentários adicionais.`;

    // Build transfer reasons string
    let transferReasonsStr = "";
    if (Array.isArray(transferReasons) && transferReasons.length > 0) {
      transferReasonsStr = transferReasons.join(", ");
    } else if (typeof transferReasons === "string") {
      transferReasonsStr = transferReasons;
    }

    // Build capabilities list
    const capabilities: string[] = [];
    if (interpretAudio) capabilities.push("Transcreve e interpreta áudios do cliente");
    if (interpretImages) capabilities.push("Analisa e interpreta imagens enviadas pelo cliente");
    if (interpretDocuments) capabilities.push("Lê e interpreta documentos (PDFs, etc.)");
    if (voiceEnabled) capabilities.push(`Responde com áudio via voz IA${voiceStyle ? ` (estilo: ${voiceStyle})` : ""}`);
    if (sendProductImages) capabilities.push("Envia imagens dos produtos quando relevante");
    if (sendProductVideos) capabilities.push("Envia vídeos dos produtos quando relevante");
    if (sendProductLinks) capabilities.push("Envia links dos produtos quando relevante");

    const userMessage = `Crie um system prompt expert-level para este agente:

MISSÃO: ${serviceLabel}
NOME: ${name || "Não definido"}
GÊNERO: ${gender || "neutro"}
TOM DE VOZ: ${tone || "formal"} (RESPEITE ESTE TOM EXATAMENTE — NÃO ALTERE)
USA EMOJIS: ${useEmojis === true ? "Sim" : useEmojis === false ? "Não" : "Sim"}
APRESENTA-SE COM NOME: ${presentName === true ? "Sim" : presentName === false ? "Não" : "Sim"}
COMPRIMENTO DAS RESPOSTAS: ${responseLength === "short" ? "Curtas e diretas" : responseLength === "long" ? "Detalhadas" : "Moderadas, adaptadas ao contexto"}

EMPRESA: ${companyName || "Não informada"}
SEGMENTO: ${segment || "Não informado"}
PRODUTOS/SERVIÇOS: ${products || "Não informados"}
PÚBLICO-ALVO: ${targetAudience || "Não informado"}
PRINCIPAL OBJEÇÃO: ${mainObjection || "Não informada"}

ESTRATÉGIA DE QUALIFICAÇÃO: ${qualificationStrategy || "Não definida"}
O QUE NUNCA FAZER: ${neverDo || "Não definido"}
TRANSFERIR PARA HUMANO QUANDO: ${transferReasonsStr || "Cliente pedir explicitamente"}
LIMITE DE MENSAGENS ANTES DE TRANSFERIR: ${maxMessages || 10} (USE EXATAMENTE ESTE NÚMERO)

CAPACIDADES DE MÍDIA:
${capabilities.length > 0 ? capabilities.map(c => `- ${c}`).join("\n") : "- Apenas texto"}

ESCOPO DE PRODUTOS: ${productScope === "all" ? "Conhece todos os produtos do catálogo" : productScope === "selected" ? "Conhece apenas produtos selecionados" : "Não definido"}

${description ? `INSTRUÇÕES ADICIONAIS DO USUÁRIO:\n${description}` : ""}`;

    let generatedPrompt: string;

    if (ANTHROPIC_API_KEY) {
      // Use Anthropic Claude
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
          // Fallback to Lovable AI if available
          if (LOVABLE_API_KEY) {
            console.log("Anthropic rate limited, falling back to Lovable AI");
            generatedPrompt = await callLovableAI(LOVABLE_API_KEY, systemPrompt, userMessage);
          } else {
            return new Response(
              JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          throw new Error(`Erro ao gerar prompt com Claude: ${response.status}`);
        }
      }

      if (!generatedPrompt!) {
        const data = await response.json();
        generatedPrompt = data.content?.[0]?.text;
      }
    } else {
      // Use Lovable AI Gateway
      generatedPrompt = await callLovableAI(LOVABLE_API_KEY!, systemPrompt, userMessage);
    }

    if (!generatedPrompt) {
      throw new Error("A IA não retornou um prompt válido");
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

async function callLovableAI(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Lovable AI error:", response.status, errorText);
    throw new Error(`Erro ao gerar prompt: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}
