import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

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
    // Get current energy balance
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("ai_energy_balance")
      .eq("id", organizationId)
      .single();

    if (orgError || !org) {
      console.error("Failed to get org energy:", orgError);
      return false;
    }

    const currentBalance = org.ai_energy_balance ?? 0;
    
    if (currentBalance < amount) {
      console.log("❌ Insufficient energy:", currentBalance, "needed:", amount);
      return false;
    }

    // Deduct energy
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ ai_energy_balance: currentBalance - amount })
      .eq("id", organizationId);

    if (updateError) {
      console.error("Failed to update energy:", updateError);
      return false;
    }

    console.log("⚡ Energy consumed:", amount, "new balance:", currentBalance - amount);
    return true;
  } catch (error) {
    console.error("Error consuming energy:", error);
    return false;
  }
}

function getMimeTypeFromFormat(format: string): string {
  switch (format) {
    case "webm": return "audio/webm";
    case "mp3": return "audio/mpeg";
    case "wav": return "audio/wav";
    case "ogg": 
    default: return "audio/ogg";
  }
}

async function transcribeAudio(mediaUrl: string): Promise<string | null> {
  console.log("🎤 Transcribing audio from:", mediaUrl);

  try {
    // Download audio from storage
    console.log("📥 Downloading audio...");
    const audioResponse = await fetch(mediaUrl);
    
    if (!audioResponse.ok) {
      console.error("❌ Failed to download audio:", audioResponse.status, audioResponse.statusText);
      throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
    }

    // IMPORTANT: a Response body can only be consumed once.
    const contentType = audioResponse.headers.get("content-type") ?? "";
    const audioBuffer = await audioResponse.arrayBuffer();
    
    // Check if buffer has data
    const bufferSize = audioBuffer.byteLength;
    console.log("📊 Audio buffer size:", bufferSize, "bytes");
    
    if (bufferSize === 0) {
      console.error("❌ Audio buffer is empty!");
      throw new Error("Audio buffer is empty");
    }
    
    if (bufferSize < 100) {
      console.error("❌ Audio buffer too small:", bufferSize, "bytes");
      throw new Error("Audio file too small, possibly corrupted");
    }

    // std/encoding/base64 accepts ArrayBuffer
    const base64Audio = base64Encode(audioBuffer);
    console.log("📝 Base64 audio length:", base64Audio.length, "characters");

    // Try to infer the real format (some audios come as webm)
    const ctFromUrl = (() => {
      try {
        const url = new URL(mediaUrl);
        return (url.searchParams.get("ct") ?? "").toLowerCase();
      } catch {
        return "";
      }
    })();

    const resolvedContentType = (ctFromUrl || contentType || "").toLowerCase();
    const audioFormat = resolvedContentType.includes("webm")
      ? "webm"
      : resolvedContentType.includes("mpeg") || resolvedContentType.includes("mp3")
        ? "mp3"
        : resolvedContentType.includes("wav")
          ? "wav"
          : "ogg";

    const mimeType = getMimeTypeFromFormat(audioFormat);
    console.log("🎧 Audio content-type:", resolvedContentType || "(unknown)", "format:", audioFormat, "mime:", mimeType);

    // Use Lovable AI Gateway for transcription with image_url format (works for audio too)
    // This format is more universally supported by the gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Tarefa: transcrever fielmente o áudio a seguir em Português Brasileiro.

Regras obrigatórias:
- Retorne APENAS o texto transcrito (sem comentários, sem formatação, sem explicações).
- NÃO invente conteúdo. Se não conseguir entender um trecho, use [...].
- Se o áudio estiver vazio, corrompido, ou inaudível, responda exatamente: Áudio inaudível
- Não 'complete' frases por contexto.
- Preserve gírias e expressões coloquiais.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Audio}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Transcription API error:", response.status, errorText);
      throw new Error(`Transcription error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const transcription = result.choices?.[0]?.message?.content?.trim() || null;

    // Check for hallucination patterns
    const hallucination_patterns = [
      "forneça o arquivo",
      "forneça o áudio", 
      "não foi enviado",
      "não consigo processar",
      "envie o áudio",
      "provide the audio",
      "file was not",
    ];
    
    const isHallucination = hallucination_patterns.some(pattern => 
      transcription?.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (isHallucination) {
      console.error("❌ Detected hallucination response:", transcription?.substring(0, 100));
      console.log("📊 Debug info - Buffer size:", bufferSize, "Base64 length:", base64Audio.length);
      throw new Error("AI returned hallucination - audio may not have been received correctly");
    }

    console.log("✅ Audio transcribed successfully:", transcription?.substring(0, 100) + (transcription && transcription.length > 100 ? "..." : ""));
    return transcription;
  } catch (error) {
    console.error("❌ Transcription failed:", error);
    return null;
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

    // Transcribe
    const transcription = await transcribeAudio(mediaUrl);

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
