import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateAvatarRequest {
  botId: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  ageRange: '18-25' | '26-35' | '36-50' | '50+';
  serviceType: string;
  brazilianState?: string;
  personalityDescription?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: GenerateAvatarRequest = await req.json();
    const { botId, name, gender, ageRange, serviceType, brazilianState, personalityDescription } = body;

    if (!botId || !name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: botId and name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the prompt for avatar generation
    const genderDescription = gender === 'male' ? 'homem brasileiro' : 
                              gender === 'female' ? 'mulher brasileira' : 
                              'robô humanoide moderno';
    
    const ageDescription = ageRange === '18-25' ? 'jovem de 20-25 anos' :
                           ageRange === '26-35' ? 'adulto de 28-32 anos' :
                           ageRange === '36-50' ? 'pessoa madura de 40-45 anos' :
                           'pessoa sênior de 55-60 anos';
    
    const serviceDescription = serviceType === 'sales' ? 'profissional de vendas confiante' :
                               serviceType === 'support' ? 'técnico prestativo' :
                               serviceType === 'sac' ? 'atendente amigável' :
                               serviceType === 'social_selling' ? 'influenciador carismático' :
                               'consultor profissional';

    const stateContext = brazilianState ? `, com características típicas de ${brazilianState}` : '';
    const personalityContext = personalityDescription ? `, expressando ${personalityDescription}` : '';

    const prompt = gender === 'neutral' 
      ? `Avatar profissional de ${genderDescription} futurista para assistente virtual de ${serviceType}. Design clean, cores suaves azul e roxo, fundo gradiente abstrato. Estilo ilustração digital moderna, rosto simpático e acolhedor. Alta qualidade, 1:1 aspect ratio.`
      : `Retrato profissional de ${genderDescription}, ${ageDescription}, ${serviceDescription}${stateContext}${personalityContext}. Expressão amigável e confiante, vestido(a) profissionalmente. Iluminação suave de estúdio, fundo neutro gradiente. Estilo foto corporativa moderna, alta qualidade, 1:1 aspect ratio.`;

    console.log("Generating avatar with prompt:", prompt);

    // Call Lovable AI Gateway for image generation
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
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI Response received:", JSON.stringify(aiResponse).substring(0, 200));

    // Extract image from response
    const imageData = aiResponse.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData) {
      console.error("No image in response:", JSON.stringify(aiResponse));
      throw new Error("No image generated");
    }

    // Upload to Supabase Storage
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const fileName = `bot-avatars/${botId}-${Date.now()}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      // If bucket doesn't exist, try to create it
      if (uploadError.message.includes('not found') || uploadError.message.includes('does not exist')) {
        // Return base64 directly if storage isn't available
        console.log("Returning base64 image directly");
        
        // Update bot with base64 avatar (limited use case)
        const { error: updateError } = await supabase
          .from('ai_bots')
          .update({ avatar_url: imageData })
          .eq('id', botId);

        if (updateError) {
          console.error("Update error:", updateError);
          throw updateError;
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            avatarUrl: imageData,
            message: "Avatar generated successfully (base64)"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Update bot with avatar URL
    const { error: updateError } = await supabase
      .from('ai_bots')
      .update({ avatar_url: publicUrl })
      .eq('id', botId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw updateError;
    }

    console.log("Avatar generated successfully:", publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        avatarUrl: publicUrl,
        message: "Avatar generated successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating avatar:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
