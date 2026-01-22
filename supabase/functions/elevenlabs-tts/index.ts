import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Curated voices for Brazilian Portuguese
export const CURATED_VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "male", description: "Voz masculina profissional e amigável" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female", description: "Voz feminina jovem e acolhedora" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "female", description: "Voz feminina suave e tranquila" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "male", description: "Voz masculina madura e confiante" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", gender: "female", description: "Voz feminina expressiva e energética" },
];

interface TTSRequest {
  text: string;
  voiceId?: string;
  organizationId: string;
  botId?: string;
  conversationId?: string;
  voiceStyle?: 'natural' | 'expressive' | 'calm';
}

interface TTSResponse {
  success: boolean;
  audioUrl?: string;
  audioPath?: string;
  energyConsumed?: number;
  actionType?: string;
  error?: string;
}

function getVoiceSettings(style: string = 'natural') {
  switch (style) {
    case 'expressive':
      return { stability: 0.3, similarity_boost: 0.75, style: 0.6, use_speaker_boost: true };
    case 'calm':
      return { stability: 0.8, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true };
    case 'natural':
    default:
      return { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true };
  }
}

function getActionTypeForLength(text: string): string {
  const length = text.length;
  if (length < 50) return 'voice_tts_short';
  if (length <= 200) return 'voice_tts_medium';
  return 'voice_tts_long';
}

function getEnergyForActionType(actionType: string): number {
  switch (actionType) {
    case 'voice_tts_short': return 15;
    case 'voice_tts_medium': return 40;
    case 'voice_tts_long': return 100;
    default: return 40;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      text, 
      voiceId = "JBFqnCBsd6RMkjVDRZzb", 
      organizationId,
      botId,
      conversationId,
      voiceStyle = 'natural'
    }: TTSRequest = await req.json();

    if (!text || !organizationId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: text, organizationId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ELEVENLABS_API_KEY) {
      console.error("❌ ELEVENLABS_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "ElevenLabs API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🎤 TTS Request:", {
      textLength: text.length,
      voiceId,
      voiceStyle,
      organizationId: organizationId.substring(0, 8) + "...",
    });

    // Get voice settings based on style
    const voiceSettings = getVoiceSettings(voiceStyle);

    // Call ElevenLabs TTS API
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.substring(0, 2500), // Limit text length
          model_id: "eleven_multilingual_v2",
          voice_settings: voiceSettings,
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("❌ ElevenLabs TTS error:", ttsResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `TTS failed: ${ttsResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get audio buffer
    const audioBuffer = await ttsResponse.arrayBuffer();
    console.log("✅ Audio generated:", audioBuffer.byteLength, "bytes");

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileName = `${organizationId}/${timestamp}-${randomId}.mp3`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("bot-audio")
      .upload(fileName, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to upload audio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("bot-audio")
      .getPublicUrl(fileName);

    const audioUrl = urlData.publicUrl;
    console.log("✅ Audio uploaded:", audioUrl);

    // Calculate energy consumption
    const actionType = getActionTypeForLength(text);
    const energyConsumed = getEnergyForActionType(actionType);

    // Log energy usage
    if (botId && conversationId) {
      await supabase.from("energy_usage_log").insert({
        organization_id: organizationId,
        bot_id: botId,
        conversation_id: conversationId,
        action_type: actionType,
        energy_consumed: energyConsumed,
        model_used: "elevenlabs/eleven_multilingual_v2",
        tokens_used: text.length, // Use char count as proxy
        real_cost_usd: actionType === 'voice_tts_short' ? 0.001 : 
                       actionType === 'voice_tts_medium' ? 0.003 : 0.008,
        details: {
          voice_id: voiceId,
          voice_style: voiceStyle,
          text_length: text.length,
          audio_size_bytes: audioBuffer.byteLength,
        },
      });
    }

    const response: TTSResponse = {
      success: true,
      audioUrl,
      audioPath: fileName,
      energyConsumed,
      actionType,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ TTS Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
