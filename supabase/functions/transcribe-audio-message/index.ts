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

    // Log the consumption
    await supabase.from("ai_energy_logs").insert({
      organization_id: organizationId,
      action_type: "audio_transcription",
      energy_consumed: amount,
      description: description,
    });

    console.log("⚡ Energy consumed:", amount, "new balance:", currentBalance - amount);
    return true;
  } catch (error) {
    console.error("Error consuming energy:", error);
    return false;
  }
}

async function transcribeAudio(mediaUrl: string): Promise<string | null> {
  console.log("🎤 Transcribing audio from:", mediaUrl);

  try {
    // Download audio from storage
    const audioResponse = await fetch(mediaUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }

    const audioBlob = await audioResponse.blob();
    const audioBuffer = await audioResponse.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    // Use Lovable AI Gateway for transcription via Gemini
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Por favor, transcreva o áudio a seguir. Retorne APENAS o texto transcrito, sem comentários ou formatação adicional. Se não conseguir entender alguma parte, use [...] para indicar. Se o áudio estiver vazio ou inaudível, responda 'Áudio inaudível'.",
              },
              {
                type: "input_audio",
                input_audio: {
                  data: base64Audio,
                  format: "ogg",
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Transcription error:", response.status, errorText);
      throw new Error(`Transcription error: ${response.status}`);
    }

    const result = await response.json();
    const transcription = result.choices?.[0]?.message?.content?.trim() || null;

    console.log("✅ Audio transcribed:", transcription?.substring(0, 100) + "...");
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
      return new Response(
        JSON.stringify({ error: "Missing required fields: messageId, organizationId, mediaUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("📝 Processing transcription request:", { messageId, organizationId });

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
