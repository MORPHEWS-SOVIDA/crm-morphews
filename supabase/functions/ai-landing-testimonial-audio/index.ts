import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestimonialAudioRequest {
  testimonials: {
    id: string;
    name: string;
    text: string;
    gender?: 'male' | 'female';
  }[];
  organizationId: string;
  generateVideo?: boolean;
}

// Brazilian Portuguese voices curated for testimonials
const VOICES = {
  female: [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
    { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura' },
    { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily' },
  ],
  male: [
    { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam' },
    { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { testimonials, organizationId, generateVideo } = await req.json() as TestimonialAudioRequest;

    if (!testimonials || testimonials.length === 0) {
      return new Response(
        JSON.stringify({ error: "No testimonials provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const results: { id: string; audioUrl: string; videoUrl?: string }[] = [];
    let totalEnergy = 0;

    for (const testimonial of testimonials) {
      // Select voice based on gender or randomly
      const voicePool = testimonial.gender === 'male' ? VOICES.male : VOICES.female;
      const voice = voicePool[Math.floor(Math.random() * voicePool.length)];

      console.log(`Generating audio for ${testimonial.name} using voice ${voice.name}`);

      // Generate audio with ElevenLabs
      const ttsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: testimonial.text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.4,
              similarity_boost: 0.75,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!ttsResponse.ok) {
        const errorText = await ttsResponse.text();
        console.error(`TTS failed for ${testimonial.id}:`, errorText);
        continue;
      }

      const audioBuffer = await ttsResponse.arrayBuffer();
      const audioBytes = new Uint8Array(audioBuffer);

      // Upload audio to storage
      const audioFileName = `testimonial-audio/${organizationId}/${testimonial.id}-${Date.now()}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from('landing-assets')
        .upload(audioFileName, audioBytes, {
          contentType: 'audio/mpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error(`Upload failed for ${testimonial.id}:`, uploadError);
        continue;
      }

      const { data: { publicUrl: audioUrl } } = supabase.storage
        .from('landing-assets')
        .getPublicUrl(audioFileName);

      // Calculate energy cost based on text length
      const textLength = testimonial.text.length;
      if (textLength < 50) {
        totalEnergy += 15;
      } else if (textLength < 200) {
        totalEnergy += 40;
      } else {
        totalEnergy += 100;
      }

      const result: { id: string; audioUrl: string; videoUrl?: string } = {
        id: testimonial.id,
        audioUrl,
      };

      // Generate video avatar if requested
      if (generateVideo) {
        try {
          // For video, we'll generate a talking avatar using the audio
          // This would integrate with a service like D-ID, HeyGen, or similar
          // For MVP, we'll use a placeholder approach with the audio overlay
          
          const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
          if (LOVABLE_API_KEY) {
            // Generate a speaking avatar frame
            const avatarPrompt = testimonial.gender === 'male' 
              ? `Professional Brazilian man in his 30s-40s, friendly smile, speaking, natural lighting, portrait style, ultra realistic`
              : `Professional Brazilian woman in her 30s-40s, friendly smile, speaking, natural lighting, portrait style, ultra realistic`;

            const avatarResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-image-preview",
                messages: [{ role: "user", content: avatarPrompt }],
                modalities: ["image", "text"],
              }),
            });

            if (avatarResponse.ok) {
              const avatarData = await avatarResponse.json();
              const avatarImageUrl = avatarData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

              if (avatarImageUrl) {
                // For now, store the avatar image as a "video thumbnail"
                // A full implementation would use a video synthesis API
                const base64Data = avatarImageUrl.split(',')[1];
                if (base64Data) {
                  const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                  const avatarFileName = `testimonial-avatars/${organizationId}/${testimonial.id}-${Date.now()}.png`;
                  
                  await supabase.storage
                    .from('landing-assets')
                    .upload(avatarFileName, imageBytes, {
                      contentType: 'image/png',
                      upsert: true,
                    });

                  const { data: { publicUrl: avatarUrl } } = supabase.storage
                    .from('landing-assets')
                    .getPublicUrl(avatarFileName);

                  result.videoUrl = avatarUrl; // For MVP, this is the avatar image
                  totalEnergy += 150; // Video avatar generation cost
                }
              }
            }
          }
        } catch (videoError) {
          console.error(`Video generation failed for ${testimonial.id}:`, videoError);
        }
      }

      results.push(result);
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        energyCost: totalEnergy,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("ai-landing-testimonial-audio error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
