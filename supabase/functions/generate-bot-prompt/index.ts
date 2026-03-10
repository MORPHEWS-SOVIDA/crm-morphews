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
      currentPrompt,
      // All behavioral settings
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const serviceLabels: Record<string, string> = {
      sales: "vendas",
      support: "suporte técnico",
      sac: "SAC (atendimento ao cliente)",
      social_selling: "social selling e relacionamento",
      qualification: "qualificação de leads",
    };

    const serviceLabel = serviceLabels[serviceType] || serviceType;

    // Build context about capabilities
    const capabilities: string[] = [];
    
    if (useEmojis === true) {
      capabilities.push("- O robô DEVE usar emojis nas respostas para tornar a conversa mais natural e acolhedora");
    } else if (useEmojis === false) {
      capabilities.push("- O robô NÃO deve usar emojis nas respostas, manter comunicação limpa e profissional");
    }

    if (interpretAudio) capabilities.push("- O robô consegue ouvir e interpretar áudios enviados pelo cliente");
    if (interpretImages) capabilities.push("- O robô consegue analisar imagens/fotos enviadas pelo cliente");
    if (interpretDocuments) capabilities.push("- O robô consegue ler e interpretar documentos (PDF, etc.) enviados pelo cliente");
    
    if (voiceEnabled) {
      const styleLabel = voiceStyle === 'natural' ? 'natural e humano' : voiceStyle === 'formal' ? 'formal e profissional' : 'descontraído';
      capabilities.push(`- O robô pode responder por áudio com estilo ${styleLabel} — deve ocasionalmente sugerir "posso te mandar um áudio explicando?" quando o assunto for complexo`);
    }

    if (maxMessages) {
      capabilities.push(`- Após ${maxMessages} mensagens sem resolução, o robô deve encaminhar para um atendente humano de forma natural`);
    }

    if (qualificationEnabled && qualificationQuestions?.length > 0) {
      const questions = qualificationQuestions.map((q: any) => q.questionText).join(", ");
      capabilities.push(`- No início da conversa, o robô deve fazer perguntas de qualificação de forma natural: ${questions}`);
    }

    if (productScope === 'all' || productScope === 'selected') {
      const mediaActions: string[] = [];
      if (sendProductImages) mediaActions.push("fotos");
      if (sendProductVideos) mediaActions.push("vídeos");
      if (sendProductLinks) mediaActions.push("links");
      if (mediaActions.length > 0) {
        capabilities.push(`- Quando falar sobre produtos, o robô pode enviar ${mediaActions.join(", ")} automaticamente — deve mencionar os produtos com naturalidade`);
      }
      capabilities.push("- O robô tem acesso ao catálogo de produtos e deve saber recomendar e tirar dúvidas sobre eles");
    } else if (productScope === 'none') {
      capabilities.push("- O robô NÃO tem acesso a produtos e não deve tentar vender ou recomendar produtos");
    }

    const capabilitiesBlock = capabilities.length > 0
      ? `\n\nCapacidades e regras de comportamento que o robô TEM (incorpore naturalmente no prompt):\n${capabilities.join("\n")}`
      : "";

    const systemPrompt = `Você é um especialista em criar system prompts para robôs de atendimento via WhatsApp.

Sua tarefa é gerar um system prompt completo e pronto para uso, em português brasileiro.

Regras:
- O prompt deve ser escrito em segunda pessoa, como se você estivesse instruindo o robô diretamente
- Inclua: personalidade, tom de voz, regras de comportamento, forma de se apresentar
- Se a descrição mencionar expressões regionais, sotaque ou gírias, incorpore no prompt
- Se a descrição mencionar regras específicas de negócio, inclua como instruções claras
- O prompt deve ser autocontido - tudo que o robô precisa saber para se comportar corretamente
- NÃO inclua instruções sobre produtos específicos ou FAQ (esses são injetados separadamente pelo sistema)
- NÃO inclua a mensagem de boas-vindas no prompt (é configurada separadamente)
- INCORPORE as capacidades e regras de comportamento fornecidas como parte natural do prompt, não como lista separada
- Escreva de forma clara e organizada, usando seções com títulos quando fizer sentido
- Retorne APENAS o texto do prompt, sem explicações ou comentários adicionais`;

    const userMessage = `Crie um system prompt para um robô de WhatsApp com as seguintes características:

Nome: ${name}
Tipo de serviço: ${serviceLabel}
${description ? `\nDescrição do usuário:\n${description}` : ""}
${capabilitiesBlock}
${currentPrompt ? `\nPrompt atual (use como referência para manter o que já funciona, mas atualize com as novas capacidades):\n${currentPrompt}` : ""}

Gere o system prompt completo:`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes para gerar o prompt." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao gerar prompt com IA");
    }

    const data = await response.json();
    const generatedPrompt = data.choices?.[0]?.message?.content;

    if (!generatedPrompt) {
      throw new Error("IA não retornou um prompt válido");
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
