import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  type: 'logo' | 'banner';
  storeName: string;
  niche: string;
  primaryColor: string;
  style?: string;
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

    const { type, storeName, niche, primaryColor, style } = await req.json() as GenerateRequest;

    // Build optimized prompt based on type
    let prompt = '';
    
    if (type === 'logo') {
      prompt = `Create a professional, modern logo for "${storeName}", a ${niche} brand. 
Style: Minimalist, clean, sophisticated. 
Color: Use ${primaryColor} as the primary brand color.
The logo should be simple, memorable, and work well at any size.
Pure white or transparent background. No text unless it's the brand initials styled elegantly.
Ultra high resolution, centered composition.`;
    } else if (type === 'banner') {
      const nichePrompts: Record<string, string> = {
        saude: 'healthy lifestyle, natural ingredients, wellness vibes, green plants, supplements, fit person',
        beleza: 'beauty products, skincare, cosmetics, elegant woman, soft lighting, luxurious',
        moda: 'fashion, stylish clothing, accessories, model pose, trendy',
        alimentos: 'gourmet food, fresh ingredients, culinary, appetizing, organic',
        casa: 'modern home, interior design, cozy living, furniture, decorative',
        tech: 'technology, gadgets, futuristic, innovation, digital',
        outro: 'professional, modern, high-quality products',
      };
      
      const nicheStyle = nichePrompts[niche] || nichePrompts.outro;
      
      prompt = `Create a stunning hero banner for "${storeName}" e-commerce store.
Theme: ${nicheStyle}
Style: ${style || 'Premium, high-end, professional marketing banner'}
Color scheme: Incorporate ${primaryColor} as accent color
Composition: 16:9 aspect ratio, suitable for website hero section
Visual elements: Beautiful product photography style, lifestyle imagery
Leave space on the left or right side for text overlay
Ultra high resolution, cinematic quality, professional marketing photography`;
    }

    console.log(`Generating ${type} for ${storeName} with prompt:`, prompt.substring(0, 100) + '...');

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
            content: prompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract image from response
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error("No image in response:", JSON.stringify(data).substring(0, 500));
      throw new Error("No image generated");
    }

    console.log(`Successfully generated ${type} image`);

    return new Response(
      JSON.stringify({ 
        success: true,
        imageUrl,
        type,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating image:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to generate image",
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
