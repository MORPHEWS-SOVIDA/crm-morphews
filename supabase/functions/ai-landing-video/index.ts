import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VideoGenerationRequest {
  type: 'hero' | 'product' | 'testimonial';
  productName: string;
  productDescription?: string;
  style: 'minimal' | 'bold' | 'luxury' | 'health';
  startingFrameUrl?: string; // Optional base64 image to animate
}

function getVideoPrompt(request: VideoGenerationRequest): string {
  const styleGuide = {
    minimal: 'clean minimalist motion, subtle movements, professional, elegant transitions',
    bold: 'dynamic motion, energetic movements, vibrant, eye-catching animations',
    luxury: 'slow sophisticated movements, premium feel, golden particles, elegant',
    health: 'natural flowing motion, organic movements, fresh, calming animations'
  };

  const style = styleGuide[request.style] || styleGuide.health;

  const prompts: Record<string, string> = {
    hero: `Cinematic product reveal animation for ${request.productName}. ${style}. Slow zoom, product rotating gracefully, professional lighting effects, particles or light rays. High-end commercial video feel.`,
    
    product: `Product showcase video of ${request.productName}. ${style}. Gentle 360 rotation, studio lighting, premium product reveal, floating animation. Clean background.`,
    
    testimonial: `Happy customer reaction video. ${style}. Person smiling, nodding, looking satisfied. Natural movements, authentic expressions, warm lighting.`
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

    const { request } = await req.json() as { request: VideoGenerationRequest };

    if (!request) {
      throw new Error("No video request provided");
    }

    const prompt = getVideoPrompt(request);
    console.log(`Generating ${request.type} video with prompt:`, prompt.substring(0, 100) + '...');

    // For now, we'll return a placeholder since video generation is more complex
    // In production, this would integrate with a video generation API
    // The Lovable videogen tool generates files directly, so for edge functions
    // we'd need to either:
    // 1. Use a different video generation API
    // 2. Return a video URL from a stock library based on the prompt
    // 3. Generate a simple animated GIF using the image API

    // For MVP, we'll generate an animated image as a "video" substitute
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
            content: `Create a single high-quality frame that suggests motion for: ${prompt}. Add motion blur or dynamic elements to convey movement. Ultra high resolution, cinematic quality.`
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Video generation failed:`, response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Add credits to your account." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("Video generation failed");
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error("No video frame generated");
    }

    // For MVP, return the dynamic frame as a video placeholder
    // In future versions, this could trigger actual video generation
    const energyCost = 100; // Video frames cost more

    return new Response(
      JSON.stringify({
        success: true,
        type: request.type,
        videoFrameUrl: imageUrl,
        prompt,
        energyCost,
        note: "Video frame generated. Full video generation coming soon."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("ai-landing-video error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
