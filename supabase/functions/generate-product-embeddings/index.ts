import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Generate embeddings using Lovable AI (uses OpenAI-compatible endpoint)
async function generateEmbedding(text: string): Promise<number[]> {
  // Use OpenAI's embedding model via proxy or direct call
  // For now, we'll use a simpler approach with Gemini text embedding
  const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000), // Limit to avoid token limits
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Embedding error:', error);
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

interface EmbeddingItem {
  product_id: string;
  organization_id: string;
  content_type: 'description' | 'faq' | 'ingredient' | 'sales_script' | 'kit_hack';
  content_text: string;
  metadata: Record<string, any>;
}

async function processProduct(productId: string, organizationId: string): Promise<number> {
  let embeddingsCreated = 0;

  // Get product details
  const { data: product } = await supabase
    .from('lead_products')
    .select('id, name, description, sales_script')
    .eq('id', productId)
    .single();

  if (!product) {
    console.log(`Product ${productId} not found`);
    return 0;
  }

  const items: EmbeddingItem[] = [];

  // Product description embedding
  if (product.description) {
    items.push({
      product_id: productId,
      organization_id: organizationId,
      content_type: 'description',
      content_text: `Produto: ${product.name}\n${product.description}`,
      metadata: { product_name: product.name },
    });
  }

  // Sales script embedding
  if (product.sales_script) {
    items.push({
      product_id: productId,
      organization_id: organizationId,
      content_type: 'sales_script',
      content_text: `Script de vendas para ${product.name}:\n${product.sales_script}`,
      metadata: { product_name: product.name },
    });
  }

  // Get FAQs
  const { data: faqs } = await supabase
    .from('product_faqs')
    .select('id, question, answer')
    .eq('product_id', productId)
    .eq('is_active', true);

  for (const faq of faqs || []) {
    items.push({
      product_id: productId,
      organization_id: organizationId,
      content_type: 'faq',
      content_text: `FAQ sobre ${product.name}:\nPergunta: ${faq.question}\nResposta: ${faq.answer}`,
      metadata: { product_name: product.name, faq_id: faq.id },
    });
  }

  // Get ingredients/composition
  const { data: ingredients } = await supabase
    .from('product_ingredients')
    .select('id, name, description')
    .eq('product_id', productId);

  if (ingredients && ingredients.length > 0) {
    const ingredientText = ingredients.map(i => 
      i.description ? `${i.name}: ${i.description}` : i.name
    ).join('\n');
    
    items.push({
      product_id: productId,
      organization_id: organizationId,
      content_type: 'ingredient',
      content_text: `Composição do ${product.name}:\n${ingredientText}`,
      metadata: { product_name: product.name, ingredient_count: ingredients.length },
    });
  }

  // Get kits with sales hacks
  const { data: kits } = await supabase
    .from('product_price_kits')
    .select('id, quantity, price_cents, sales_hack')
    .eq('product_id', productId)
    .eq('is_active', true)
    .not('sales_hack', 'is', null);

  for (const kit of kits || []) {
    if (kit.sales_hack) {
      items.push({
        product_id: productId,
        organization_id: organizationId,
        content_type: 'kit_hack',
        content_text: `Hack de vendas para kit de ${kit.quantity} unidades do ${product.name} (R$${(kit.price_cents / 100).toFixed(2)}):\n${kit.sales_hack}`,
        metadata: { product_name: product.name, kit_id: kit.id, quantity: kit.quantity },
      });
    }
  }

  // Delete existing embeddings for this product
  await supabase
    .from('product_embeddings')
    .delete()
    .eq('product_id', productId);

  // Generate and store embeddings
  for (const item of items) {
    try {
      const embedding = await generateEmbedding(item.content_text);
      
      const { error } = await supabase
        .from('product_embeddings')
        .insert({
          product_id: item.product_id,
          organization_id: item.organization_id,
          content_type: item.content_type,
          content_text: item.content_text,
          embedding: embedding,
          metadata: item.metadata,
        });

      if (error) {
        console.error('Error inserting embedding:', error);
      } else {
        embeddingsCreated++;
      }
    } catch (err) {
      console.error(`Error generating embedding for ${item.content_type}:`, err);
    }
  }

  return embeddingsCreated;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product_id, organization_id, regenerate_all } = await req.json();

    if (regenerate_all && organization_id) {
      // Regenerate all embeddings for an organization
      console.log(`🔄 Regenerating all embeddings for org ${organization_id}`);
      
      const { data: products } = await supabase
        .from('lead_products')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('is_active', true);

      let totalEmbeddings = 0;
      for (const product of products || []) {
        const count = await processProduct(product.id, organization_id);
        totalEmbeddings += count;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Generated ${totalEmbeddings} embeddings for ${products?.length || 0} products` 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (product_id && organization_id) {
      // Process single product
      console.log(`🔄 Generating embeddings for product ${product_id}`);
      const count = await processProduct(product_id, organization_id);

      return new Response(
        JSON.stringify({ success: true, message: `Generated ${count} embeddings` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Missing product_id or organization_id" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
