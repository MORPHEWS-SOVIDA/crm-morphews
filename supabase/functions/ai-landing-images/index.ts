import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImageGenerationRequest {
  type: 'hero' | 'product' | 'testimonial' | 'benefit' | 'mechanism';
  productName: string;
  productDescription?: string;
  style: 'minimal' | 'bold' | 'luxury' | 'health';
  context?: string; // Additional context for the image
}

function getImagePrompt(request: ImageGenerationRequest): string {
  const styleGuide = {
    minimal: 'clean minimalist design, white background, professional photography, high-end product shot',
    bold: 'vibrant colors, dynamic composition, energetic, modern design, eye-catching',
    luxury: 'luxury aesthetic, gold accents, dark elegant background, premium feel, sophisticated',
    health: 'natural lighting, green and white tones, organic feel, fresh, wellness aesthetic'
  };

  const style = styleGuide[request.style] || styleGuide.health;

  const prompts: Record<string, string> = {
    hero: `Ultra high resolution hero banner image for landing page. ${request.productName} product showcase. ${style}. Professional commercial photography, centered composition, dramatic lighting. ${request.productDescription || ''}. 16:9 aspect ratio hero image.`,
    
    product: `Ultra high resolution product photography of ${request.productName}. ${style}. Clean studio shot, professional lighting, floating product with soft shadows, premium packaging visible. Commercial quality. ${request.productDescription || ''}`,
    
    testimonial: `Professional portrait photo of a happy customer, natural smile, authentic expression. ${style}. Soft lighting, warm tones, approachable look. Person looks satisfied and confident. High quality portrait photography.`,
    
    benefit: `Visual representation of transformation/benefit: ${request.context || request.productDescription}. ${style}. Conceptual illustration, before/after feeling, positive outcome visualization. Professional marketing image.`,
    
    mechanism: `Scientific/mechanism of action illustration for ${request.productName}. ${style}. Clean infographic style, showing how the product works. Professional, trustworthy, educational visual. ${request.context || ''}`
  };

  return prompts[request.type] || prompts.product;
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

    const { requests } = await req.json() as { requests: ImageGenerationRequest[] };

    if (!requests || requests.length === 0) {
      throw new Error("No image requests provided");
    }

    console.log(`Generating ${requests.length} images...`);

    // Generate images in parallel (max 3 at a time to avoid rate limits)
    const batchSize = 3;
    const results: { type: string; imageUrl: string; prompt: string }[] = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (request) => {
        const prompt = getImagePrompt(request);
        console.log(`Generating ${request.type} image with prompt:`, prompt.substring(0, 100) + '...');

        try {
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image-preview",
              messages: [
                {
                  role: "user",
                  content: prompt
                }
              ],
              modalities: ["image", "text"]
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Image generation failed for ${request.type}:`, response.status, errorText);
            
            if (response.status === 429) {
              throw new Error("Rate limit exceeded");
            }
            if (response.status === 402) {
              throw new Error("Payment required");
            }
            
            return null;
          }

          const data = await response.json();
          const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

          if (!imageUrl) {
            console.error(`No image URL in response for ${request.type}`);
            return null;
          }

          return {
            type: request.type,
            imageUrl,
            prompt
          };
        } catch (error) {
          console.error(`Error generating ${request.type} image:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null) as { type: string; imageUrl: string; prompt: string }[]);

      // Small delay between batches to avoid rate limits
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Calculate energy cost based on number of images generated
    const energyCostPerImage = 50; // Each image costs 50 energy
    const totalEnergy = results.length * energyCostPerImage;

    return new Response(
      JSON.stringify({
        success: true,
        images: results,
        energyCost: totalEnergy,
        generated: results.length,
        requested: requests.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("ai-landing-images error:", error);
    
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Rate limit") ? 429 : 
                   message.includes("Payment required") ? 402 : 500;

    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
