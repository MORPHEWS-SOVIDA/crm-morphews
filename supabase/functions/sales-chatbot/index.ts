import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ProductContext {
  name: string;
  description?: string;
  price: number;
  benefits?: string[];
  faq?: { question: string; answer: string }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      messages, 
      product, 
      landingPageId, 
      storefrontId,
      mode = "sales" // sales | recommendations | telesales
    } = await req.json();

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build context based on mode
    let systemPrompt = "";
    let productContext: ProductContext | null = null;

    // Fetch product data if provided
    if (product?.id || landingPageId) {
      const productId = product?.id;
      
      if (productId) {
        const { data: productData } = await supabase
          .from('lead_products')
          .select('name, description, price_cents, ecommerce_benefits')
          .eq('id', productId)
          .single();

        if (productData) {
          productContext = {
            name: productData.name,
            description: productData.description,
            price: productData.price_cents,
            benefits: productData.ecommerce_benefits,
          };
        }
      }

      if (landingPageId) {
        const { data: landing } = await supabase
          .from('landing_pages')
          .select(`
            headline, benefits, faq, guarantee_text, product_id
          `)
          .eq('id', landingPageId)
          .single();

        if (landing) {
          // Fetch product separately
          const { data: landingProduct } = await supabase
            .from('lead_products')
            .select('name, description, price_cents')
            .eq('id', landing.product_id)
            .single();

          productContext = {
            name: landingProduct?.name || product?.name || "Produto",
            description: landing.headline || landingProduct?.description,
            price: landingProduct?.price_cents || product?.price || 0,
            benefits: landing.benefits as string[],
            faq: landing.faq as { question: string; answer: string }[],
          };
        }
      }
    }

    // Build system prompt based on mode
    switch (mode) {
      case "sales":
        systemPrompt = `Você é um assistente de vendas especializado e persuasivo. Seu objetivo é ajudar o cliente a tomar a decisão de compra.

REGRAS:
- Seja amigável, empático e profissional
- Responda de forma concisa (máximo 3 parágrafos)
- Sempre destaque benefícios e valor, não só preço
- Use gatilhos de urgência quando apropriado
- Se não souber algo específico, ofereça passar para um atendente humano
- NUNCA invente informações sobre o produto

${productContext ? `
PRODUTO: ${productContext.name}
${productContext.description ? `DESCRIÇÃO: ${productContext.description}` : ''}
PREÇO: R$ ${(productContext.price / 100).toFixed(2)}
${productContext.benefits?.length ? `BENEFÍCIOS:\n${productContext.benefits.map(b => `• ${b}`).join('\n')}` : ''}
${productContext.faq?.length ? `FAQ:\n${productContext.faq.map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n')}` : ''}
` : ''}

Ajude o cliente a entender o valor e converta a venda!`;
        break;

      case "recommendations":
        systemPrompt = `Você é um consultor de produtos inteligente. Seu papel é entender as necessidades do cliente e recomendar produtos adequados.

REGRAS:
- Faça perguntas para entender o perfil do cliente
- Sugira produtos baseado nas respostas
- Explique por que cada produto é adequado
- Ofereça comparações quando útil
- Seja consultivo, não agressivo

Ajude o cliente a encontrar o produto perfeito para suas necessidades!`;
        break;

      case "telesales":
        systemPrompt = `Você é um copiloto de vendas para auxiliar vendedores de televendas.

REGRAS:
- Forneça informações rápidas sobre produtos
- Sugira argumentos de venda e objeções
- Ajude com cálculos de preço e descontos
- Ofereça scripts de abordagem
- Seja direto e objetivo (vendedor precisa de respostas rápidas)

${productContext ? `
CONTEXTO DO PRODUTO:
Nome: ${productContext.name}
Preço: R$ ${(productContext.price / 100).toFixed(2)}
${productContext.benefits?.length ? `Benefícios: ${productContext.benefits.join(', ')}` : ''}
` : ''}

Ajude o vendedor a fechar a venda!`;
        break;
    }

    // Prepare messages for AI
    const aiMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: ChatMessage) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // Call Lovable AI Gateway with streaming
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Aguarde um momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    // Return streaming response
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Sales chatbot error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
