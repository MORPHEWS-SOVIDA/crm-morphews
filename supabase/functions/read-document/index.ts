import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// AI PROVIDER: Gemini Direct (GEMINI_API_KEY) > Lovable Gateway (LOVABLE_API_KEY)
// ============================================================================
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const GEMINI_MODEL_MAP: Record<string, string> = {
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

function getAIConfig(model: string) {
  if (GEMINI_API_KEY) {
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      headers: { 'Authorization': `Bearer ${GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
      model: GEMINI_MODEL_MAP[model] || 'gemini-2.0-flash',
    };
  }
  const lk = Deno.env.get("LOVABLE_API_KEY") ?? "";
  return {
    url: getAIConfig('').url,
    headers: { 'Authorization': `Bearer ${lk}`, 'Content-Type': 'application/json' },
    model,
  };
}

async function fetchAI(body: Record<string, any>, stream = false): Promise<Response> {
  const model = body.model || '';
  const config = getAIConfig(model);
  return fetch(config.url, {
    method: 'POST',
    headers: config.headers,
    body: JSON.stringify({ ...body, model: config.model }),
  });
}

async function fetchEmbedding(body: Record<string, any>): Promise<Response> {
  const config = getEmbeddingConfig();
  return fetch(config.url, {
    method: 'POST',
    headers: config.headers,
    body: JSON.stringify(body),
  });
}

function getEmbeddingConfig() {
  if (GEMINI_API_KEY) {
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/embeddings',
      headers: { 'Authorization': `Bearer ${GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
    };
  }
  const lk = Deno.env.get("LOVABLE_API_KEY") ?? "";
  return {
    url: getEmbeddingConfig().url,
    headers: { 'Authorization': `Bearer ${lk}`, 'Content-Type': 'application/json' },
  };
}



const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ENERGY_COST_PER_DOCUMENT = 100;

// Generic prompt for all document types
const GENERIC_PROMPT = `Você é um especialista em interpretar documentos e extrair informações estruturadas.

TAREFA: Analise este documento PDF/imagem e extraia TODAS as informações relevantes.

FORMATO DE RESPOSTA (JSON):
{
  "rawText": "Transcrição completa do documento, linha por linha",
  "summary": "Resumo executivo em 2-3 frases descrevendo o conteúdo principal",
  "medications": [],
  "items": [
    {
      "name": "Nome do item/produto/serviço",
      "details": "Detalhes adicionais (quantidade, especificação, valor, etc.)",
      "quantity": "Quantidade se aplicável",
      "notes": "Observações"
    }
  ],
  "prescriberInfo": null,
  "structuredData": {
    "recipientName": "Nome do destinatário/cliente/paciente",
    "documentDate": "Data do documento",
    "documentType": "tipo (receita/orçamento/nota/pedido/lista/catálogo/contrato/outro)",
    "totalValue": "Valor total se houver",
    "additionalNotes": "Observações extras"
  }
}

INSTRUÇÕES:
- Adapte a interpretação ao TIPO de documento (receita médica, orçamento, nota fiscal, lista de compras, pedido, etc.)
- Se for receita médica, foque em medicamentos com dosagem exata
- Se for orçamento/nota, extraia itens com valores e quantidades
- Se for lista/pedido, liste todos os itens solicitados
- Se não conseguir ler algo, indique "[ilegível]"
- Mantenha nomes de produtos/medicamentos EXATAMENTE como escritos`;

// Specialized prompt for medical prescriptions (Turbo Mode)
const MEDICAL_TURBO_PROMPT = `Você é um ESPECIALISTA FARMACÊUTICO com anos de experiência em interpretar receitas médicas manuscritas e digitais.

🎯 MISSÃO CRÍTICA: Extrair com MÁXIMA PRECISÃO todas as informações de prescrições médicas, mesmo com caligrafia difícil.

FORMATO DE RESPOSTA (JSON):
{
  "rawText": "Transcrição COMPLETA do documento, linha por linha, incluindo trechos ilegíveis marcados",
  "summary": "Resumo para o atendente: X medicamentos identificados, Dr. [nome], CRM [número]",
  "medications": [
    {
      "name": "Nome EXATO do medicamento ou fórmula (ex: 'Cápsulas de Melatonina + Magnésio')",
      "components": ["Lista de componentes da fórmula se for manipulado"],
      "dosage": "Concentração exata (ex: '3mg', '500mg', '100.000 UI')",
      "form": "Forma farmacêutica (cápsula, comprimido, creme, solução, etc.)",
      "quantity": "Quantidade prescrita (ex: '60 cápsulas', '1 frasco', '30 sachês')",
      "frequency": "Posologia/frequência (ex: '1x ao dia à noite', '8/8h', 'ao deitar')",
      "duration": "Duração do tratamento se especificada",
      "instructions": "Instruções especiais (com ou sem alimentos, jejum, etc.)",
      "confidence": "alta/média/baixa - confiança na leitura"
    }
  ],
  "prescriberInfo": {
    "name": "Nome completo do médico/prescritor",
    "crm": "Número do CRM com estado (ex: 'CRM-SP 123456')",
    "specialty": "Especialidade médica se visível",
    "clinic": "Nome do consultório/clínica se houver",
    "contact": "Telefone ou endereço se visível"
  },
  "structuredData": {
    "patientName": "Nome completo do paciente",
    "documentDate": "Data da receita",
    "documentType": "receita_simples/receita_especial/laudo/atestado/exame",
    "isControlled": true/false,
    "additionalNotes": "Observações do médico, alergias mencionadas, etc."
  }
}

🔍 TÉCNICAS PARA CALIGRAFIA DIFÍCIL:
1. Use CONTEXTO MÉDICO para inferir: "Omep..." provavelmente é "Omeprazol"
2. Concentrações comuns: 10mg, 20mg, 40mg, 100mg, 500mg, 1g
3. Frequências padrão: 1x/dia, 2x/dia, 8/8h, 12/12h, ao deitar
4. Se houver dúvida entre duas leituras, indique ambas: "Amoxicilina (ou Amitriptilina?)"
5. Marque trechos ilegíveis: "[ilegível - parece dosagem]"

⚠️ IMPORTANTE:
- NUNCA invente informações - marque como "[ilegível]" se não conseguir ler
- Priorize SEGURANÇA: é melhor marcar dúvida do que interpretar errado
- Para fórmulas manipuladas, liste CADA componente separadamente
- CRM é CRÍTICO - busque em carimbos, rodapés, cantos da página`;

// Convert PDF to images and analyze with Gemini Vision
async function analyzeDocumentWithVision(
  documentUrl: string,
  documentType: string,
  useMedicalMode: boolean = false
): Promise<{
  rawText: string;
  summary: string;
  medications: any[];
  prescriberInfo: any;
  structuredData: any;
}> {
  console.log("📄 Analyzing document with AI Vision:", documentUrl, "Medical mode:", useMedicalMode);

  const systemPrompt = useMedicalMode ? MEDICAL_TURBO_PROMPT : GENERIC_PROMPT;

    fetchAI({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analise este documento e extraia todas as informações no formato JSON especificado:",
            },
            {
              type: "image_url",
              image_url: { url: documentUrl },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("❌ AI Vision error:", error);
    throw new Error(`AI Vision failed: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "{}";

  try {
    const parsed = JSON.parse(content);
    return {
      rawText: parsed.rawText || "",
      summary: parsed.summary || "Documento analisado",
      medications: parsed.medications || [],
      prescriberInfo: parsed.prescriberInfo || null,
      structuredData: parsed.structuredData || {},
    };
  } catch {
    return {
      rawText: content,
      summary: "Documento processado",
      medications: [],
      prescriberInfo: null,
      structuredData: {},
    };
  }
}

// Send message back to the customer via Evolution API
async function sendMessageToCustomer(
  instanceName: string,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    if (!response.ok) {
      console.error("❌ Failed to send message:", await response.text());
      return false;
    }

    console.log("✅ Message sent to customer");
    return true;
  } catch (error) {
    console.error("❌ Error sending message:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      messageId,
      conversationId,
      organizationId,
      documentUrl,
      documentType = "pdf",
      conversationStatus, // 'with_bot' | 'assigned' | 'pending'
      instanceName,
      customerPhone,
      leadId,
    } = await req.json();

    console.log("📄 read-document called:", {
      messageId,
      conversationId,
      documentType,
      conversationStatus,
    });

    if (!messageId || !conversationId || !organizationId || !documentUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if document reading is enabled for org
    const { data: org } = await supabase
      .from("organizations")
      .select("whatsapp_document_reading_enabled, whatsapp_document_auto_reply_message, whatsapp_document_medical_mode, ai_energy_balance")
      .eq("id", organizationId)
      .single();

    if (!org?.whatsapp_document_reading_enabled) {
      console.log("📄 Document reading disabled for org");
      return new Response(
        JSON.stringify({ success: false, reason: "disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check energy balance
    const currentEnergy = org.ai_energy_balance ?? 0;
    if (currentEnergy < ENERGY_COST_PER_DOCUMENT) {
      console.log("⚡ Insufficient energy for document reading");
      return new Response(
        JSON.stringify({ success: false, reason: "insufficient_energy" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create document reading record
    const { data: reading, error: insertError } = await supabase
      .from("whatsapp_document_readings")
      .insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        message_id: messageId,
        lead_id: leadId || null,
        document_url: documentUrl,
        document_type: documentType,
        status: "processing",
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ Error creating reading record:", insertError);
      throw insertError;
    }

    // Deduct energy
    await supabase
      .from("organizations")
      .update({ ai_energy_balance: currentEnergy - ENERGY_COST_PER_DOCUMENT })
      .eq("id", organizationId);

    // Log energy usage
    await supabase.from("energy_usage_log").insert({
      organization_id: organizationId,
      action_type: "document_reading",
      energy_consumed: ENERGY_COST_PER_DOCUMENT,
      conversation_id: conversationId,
      details: { document_type: documentType, message_id: messageId },
    });

    // Analyze document
    const useMedicalMode = (org as any).whatsapp_document_medical_mode === true;
    let analysis;
    try {
      analysis = await analyzeDocumentWithVision(documentUrl, documentType, useMedicalMode);
    } catch (error) {
      console.error("❌ Document analysis failed:", error);
      
      await supabase
        .from("whatsapp_document_readings")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Analysis failed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", reading.id);

      return new Response(
        JSON.stringify({ success: false, error: "analysis_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update reading with results
    await supabase
      .from("whatsapp_document_readings")
      .update({
        raw_text: analysis.rawText,
        summary: analysis.summary,
        medications: analysis.medications,
        prescriber_info: analysis.prescriberInfo,
        structured_data: analysis.structuredData,
        status: "completed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", reading.id);

    // Decide action based on conversation status
    const isWithBot = conversationStatus === "with_bot";

    if (isWithBot && instanceName && customerPhone) {
      // Bot mode: Send summary to customer
      const autoReplyMessage = org.whatsapp_document_auto_reply_message || 
        "Nossa IA recebeu seu arquivo e interpretou assim:";

      let medicationsSummary = "";
      if (analysis.medications && analysis.medications.length > 0) {
        medicationsSummary = "\n\n📋 *Medicamentos identificados:*\n" +
          analysis.medications.map((med: any, i: number) => 
            `${i + 1}. ${med.name}${med.dosage ? ` - ${med.dosage}` : ""}${med.frequency ? ` (${med.frequency})` : ""}`
          ).join("\n");
      }

      const fullMessage = `${autoReplyMessage}\n\n${analysis.summary}${medicationsSummary}\n\n_Está correto? Posso ajudar com mais alguma coisa?_`;

      const sent = await sendMessageToCustomer(instanceName, customerPhone, fullMessage);

      if (sent) {
        // Save bot response as message
        await supabase.from("whatsapp_messages").insert({
          instance_id: (await supabase
            .from("whatsapp_instances")
            .select("id")
            .eq("evolution_instance_id", instanceName)
            .single()).data?.id,
          conversation_id: conversationId,
          message_type: "text",
          content: fullMessage,
          direction: "outbound",
          status: "sent",
          is_from_bot: true,
          provider: "evolution",
        });

        await supabase
          .from("whatsapp_document_readings")
          .update({ auto_replied: true })
          .eq("id", reading.id);
      }
    } else {
      // Human mode: Just mark as processed, seller will see in chat
      await supabase
        .from("whatsapp_document_readings")
        .update({ seller_notified: true })
        .eq("id", reading.id);
    }

    console.log("✅ Document processed successfully:", reading.id);

    return new Response(
      JSON.stringify({
        success: true,
        readingId: reading.id,
        summary: analysis.summary,
        medicationsCount: analysis.medications?.length || 0,
        autoReplied: isWithBot,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ read-document error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
