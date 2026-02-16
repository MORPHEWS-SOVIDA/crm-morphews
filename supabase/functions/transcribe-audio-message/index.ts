import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Cost in "energy units" for audio transcription
const TRANSCRIPTION_ENERGY_COST = 50;

interface TranscribeRequest {
  messageId: string;
  organizationId: string;
  mediaUrl: string;
}

async function consumeEnergy(organizationId: string, amount: number, description: string): Promise<boolean> {
  try {
    // Use the consume_energy RPC with its correct signature
    const { data, error } = await supabase.rpc('consume_energy', {
      p_organization_id: organizationId,
      p_energy_amount: amount,
      p_action_type: 'audio_transcription',
      p_details: description,
      p_model_used: 'whisper-large-v3-turbo',
      p_tokens_used: 0,
      p_real_cost_usd: 0,
      p_bot_id: null,
      p_conversation_id: null,
    });

    if (error) {
      console.error("❌ consume_energy RPC error:", error);
      return false;
    }

    // Check the result
    if (data && typeof data === 'object') {
      const result = data as { success?: boolean; error?: string; remaining?: number };
      if (result.success === false || result.error) {
        console.log("❌ Insufficient energy for transcription");
        return false;
      }
      console.log("⚡ Energy consumed:", amount, "remaining:", result.remaining);
      return true;
    }

    // Fallback: if RPC returns true/false directly
    if (data === true) {
      console.log("⚡ Energy consumed:", amount);
      return true;
    }
    
    console.log("❌ Energy consumption failed");
    return false;
  } catch (error) {
    console.error("Error consuming energy:", error);
    return false;
  }
}

function getExtensionFromMimeType(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("mp3") || mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  return "ogg";
}

async function transcribeAudioWithGroq(mediaUrl: string): Promise<string | null> {
  if (!GROQ_API_KEY) {
    console.error("❌ GROQ_API_KEY not configured");
    throw new Error("GROQ_API_KEY não configurada. Configure nas configurações de secrets.");
  }

  console.log("🎤 Transcribing audio with Groq Whisper from:", mediaUrl);

  try {
    // Download audio from storage/URL
    console.log("📥 Downloading audio...");
    const audioResponse = await fetch(mediaUrl);
    
    if (!audioResponse.ok) {
      console.error("❌ Failed to download audio:", audioResponse.status, audioResponse.statusText);
      throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
    }

    const contentType = audioResponse.headers.get("content-type") ?? "audio/ogg";
    const audioBuffer = await audioResponse.arrayBuffer();
    
    // Check if buffer has data
    const bufferSize = audioBuffer.byteLength;
    console.log("📊 Audio buffer size:", bufferSize, "bytes, content-type:", contentType);
    
    if (bufferSize === 0) {
      console.error("❌ Audio buffer is empty!");
      throw new Error("Audio buffer is empty");
    }
    
    if (bufferSize < 100) {
      console.error("❌ Audio buffer too small:", bufferSize, "bytes");
      throw new Error("Audio file too small, possibly corrupted");
    }

    // Determine file extension from content type or URL
    const ctFromUrl = (() => {
      try {
        const url = new URL(mediaUrl);
        return (url.searchParams.get("ct") ?? "").toLowerCase();
      } catch {
        return "";
      }
    })();
    const resolvedContentType = (ctFromUrl || contentType || "audio/ogg").toLowerCase();
    const ext = getExtensionFromMimeType(resolvedContentType);
    
    console.log("🎧 Resolved content-type:", resolvedContentType, "extension:", ext);

    // Create blob and FormData for Groq Whisper API
    const blob = new Blob([audioBuffer], { type: resolvedContentType });
    const formData = new FormData();
    formData.append("file", blob, `audio.${ext}`);
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("language", "pt");
    formData.append("response_format", "text");

    console.log("🚀 Sending to Groq Whisper API...");
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Groq Whisper transcription failed:", response.status, errText);
      
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Tente novamente em alguns minutos.");
      }
      if (response.status === 401) {
        throw new Error("GROQ_API_KEY inválida. Verifique nas configurações.");
      }
      
      throw new Error(`Groq transcription error: ${response.status} - ${errText}`);
    }

    const transcription = await response.text();
    
    if (!transcription || transcription.trim().length === 0) {
      console.log("⚠️ Empty transcription returned (audio may be silent or inaudible)");
      return "Áudio inaudível";
    }
    
    console.log("✅ Audio transcribed with Groq Whisper:", transcription.substring(0, 100) + (transcription.length > 100 ? "..." : ""));
    return transcription.trim();
  } catch (error) {
    console.error("❌ Transcription failed:", error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, organizationId, mediaUrl }: TranscribeRequest = await req.json();

    if (!messageId || !organizationId || !mediaUrl) {
      console.error("❌ Missing required fields:", { messageId: !!messageId, organizationId: !!organizationId, mediaUrl: !!mediaUrl });
      return new Response(
        JSON.stringify({ error: "Missing required fields: messageId, organizationId, mediaUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("📝 Processing transcription request:", { messageId, organizationId, mediaUrlLength: mediaUrl?.length });

    // Mark as processing
    await supabase
      .from("whatsapp_messages")
      .update({ transcription_status: "processing" })
      .eq("id", messageId);

    // Check and consume energy
    const hasEnergy = await consumeEnergy(
      organizationId,
      TRANSCRIPTION_ENERGY_COST,
      `Transcrição de áudio - mensagem ${messageId}`
    );

    if (!hasEnergy) {
      console.log("❌ Insufficient energy for transcription");
      await supabase
        .from("whatsapp_messages")
        .update({ transcription_status: "failed" })
        .eq("id", messageId);

      return new Response(
        JSON.stringify({ error: "Insufficient energy balance" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transcribe with Groq Whisper
    let transcription: string | null = null;
    try {
      transcription = await transcribeAudioWithGroq(mediaUrl);
    } catch (error) {
      console.error("❌ Transcription error:", error);
      
      await supabase
        .from("whatsapp_messages")
        .update({ transcription_status: "failed" })
        .eq("id", messageId);

      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Transcription failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!transcription) {
      console.log("❌ Transcription returned null");
      await supabase
        .from("whatsapp_messages")
        .update({ transcription_status: "failed" })
        .eq("id", messageId);

      return new Response(
        JSON.stringify({ error: "Transcription failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save transcription
    const { error: updateError } = await supabase
      .from("whatsapp_messages")
      .update({
        transcription: transcription,
        transcription_status: "completed",
      })
      .eq("id", messageId);

    if (updateError) {
      console.error("❌ Failed to save transcription:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save transcription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Transcription saved for message:", messageId);

    return new Response(
      JSON.stringify({ success: true, transcription }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ transcribe-audio-message error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
