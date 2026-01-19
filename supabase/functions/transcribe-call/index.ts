import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TranscribeRequest {
  attendanceId: string;
  audioUrl?: string;
  storagePath?: string;
}

interface CallQualityScore {
  proper_greeting_score: number;
  asked_needs_score: number;
  followed_script_score: number;
  offered_kits_score: number;
  handled_objections_score: number;
  clear_next_steps_score: number;
  overall_score: number;
  summary: string;
  improvements: string[];
}

const ENERGY_COST_TRANSCRIPTION = 50;
const ENERGY_COST_ANALYSIS = 20;

type AudioFormat = "mp3" | "wav" | "ogg" | "m4a" | "mp4";

function extractStoragePathFromReceptiveUrl(audioUrl: string): string | null {
  try {
    const url = new URL(audioUrl);
    const p = url.pathname;

    const signedPrefix = "/storage/v1/object/sign/receptive-recordings/";
    const publicPrefix = "/storage/v1/object/public/receptive-recordings/";

    const signedIdx = p.indexOf(signedPrefix);
    if (signedIdx !== -1) return decodeURIComponent(p.slice(signedIdx + signedPrefix.length));

    const publicIdx = p.indexOf(publicPrefix);
    if (publicIdx !== -1) return decodeURIComponent(p.slice(publicIdx + publicPrefix.length));

    return null;
  } catch {
    return null;
  }
}

function inferAudioFormat(value: string | undefined): AudioFormat {
  const v = (value || "").toLowerCase();
  const ext = v.split("?")[0].split("#")[0].split(".").pop();
  if (ext === "wav") return "wav";
  if (ext === "ogg") return "ogg";
  if (ext === "m4a") return "m4a";
  if (ext === "mp4") return "mp4";
  return "mp3";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { attendanceId, audioUrl, storagePath }: TranscribeRequest = await req.json();

    if (!attendanceId || (!audioUrl && !storagePath)) {
      return new Response(JSON.stringify({ error: "attendanceId and (audioUrl or storagePath) are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1) Resolve org
    const { data: attendance, error: attendanceError } = await supabase
      .from("receptive_attendances")
      .select("organization_id")
      .eq("id", attendanceId)
      .single();

    if (attendanceError || !attendance) {
      return new Response(JSON.stringify({ error: "Attendance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = attendance.organization_id;

    // 2) Consume energy
    const totalEnergyCost = ENERGY_COST_TRANSCRIPTION + ENERGY_COST_ANALYSIS;
    const { data: energyResult, error: energyError } = await supabase.rpc("consume_energy", {
      p_organization_id: organizationId,
      p_bot_id: null,
      p_conversation_id: null,
      p_action_type: "call_transcription",
      p_energy_amount: totalEnergyCost,
      p_tokens_used: null,
      p_details: { attendance_id: attendanceId, timestamp: new Date().toISOString() },
    });

    if (energyError) {
      console.error("Energy consumption error:", energyError);
      return new Response(JSON.stringify({ error: "Erro ao verificar energia. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const energyOk = typeof energyResult === "boolean" ? energyResult : (energyResult?.success ?? true);
    if (!energyOk) {
      return new Response(
        JSON.stringify({
          error: "Energia insuficiente para transcrição. Entre em contato com o administrador.",
          available_energy: energyResult?.available_energy,
          required_energy: totalEnergyCost,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Mark processing
    await supabase.from("receptive_attendances").update({ transcription_status: "processing" }).eq("id", attendanceId);

    // 4) Prefer storagePath (fresh signed URL) to avoid expired URL issues
    const derivedStoragePath = !storagePath && audioUrl ? extractStoragePathFromReceptiveUrl(audioUrl) : null;
    const effectiveStoragePath = storagePath || derivedStoragePath || undefined;

    let effectiveAudioUrl = audioUrl;
    if (effectiveStoragePath) {
      const { data: signed, error: signErr } = await supabase.storage
        .from("receptive-recordings")
        .createSignedUrl(effectiveStoragePath, 3600);

      if (signErr || !signed?.signedUrl) {
        console.error("Signed URL generation error:", signErr);
      } else {
        effectiveAudioUrl = signed.signedUrl;
      }
    }

    if (!effectiveAudioUrl) {
      await supabase.from("receptive_attendances").update({ transcription_status: "failed" }).eq("id", attendanceId);
      return new Response(JSON.stringify({ error: "Não foi possível acessar o áudio." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioFormat = inferAudioFormat(effectiveStoragePath || effectiveAudioUrl);

    // 5) Download and base64
    let audioBase64: string;
    try {
      const audioResponse = await fetch(effectiveAudioUrl);
      if (!audioResponse.ok) throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
      const audioBuffer = await audioResponse.arrayBuffer();
      audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
    } catch (audioError) {
      console.error("Error fetching audio:", audioError);
      await supabase.from("receptive_attendances").update({ transcription_status: "failed" }).eq("id", attendanceId);
      return new Response(
        JSON.stringify({
          error: "Não foi possível baixar o áudio para transcrição.",
          details: audioError instanceof Error ? audioError.message : String(audioError),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 6) Transcribe
    const transcriptionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um transcriptor especializado em ligações de vendas em português brasileiro. " +
              "Transcreva o áudio de forma precisa, identificando diferentes falantes quando possível (Vendedor, Cliente). " +
              "Formate a transcrição de forma clara com quebras de linha entre as falas.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Por favor, transcreva esta ligação de vendas:" },
              {
                type: "input_audio",
                input_audio: {
                  data: audioBase64,
                  format: audioFormat,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error("Transcription API error:", transcriptionResponse.status, errorText);
      await supabase.from("receptive_attendances").update({ transcription_status: "failed" }).eq("id", attendanceId);

      if (transcriptionResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (transcriptionResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Transcription failed", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transcriptionResult = await transcriptionResponse.json();
    const transcription = transcriptionResult.choices?.[0]?.message?.content || "";

    // 7) Analyze
    const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um analista de qualidade de vendas. Analise a transcrição de uma ligação de vendas e avalie cada critério com uma nota de 1 a 10. " +
              "Retorne APENAS um JSON válido sem markdown ou explicações adicionais.",
          },
          {
            role: "user",
            content: `Analise esta transcrição de ligação de vendas e retorne um JSON com notas de 1-10 para cada critério:

{
  "proper_greeting_score": number,
  "asked_needs_score": number,
  "followed_script_score": number,
  "offered_kits_score": number,
  "handled_objections_score": number,
  "clear_next_steps_score": number,
  "overall_score": number,
  "summary": string,
  "improvements": string[]
}

Transcrição:
${transcription}`,
          },
        ],
      }),
    });

    let callQualityScore: CallQualityScore | null = null;
    if (analysisResponse.ok) {
      const analysisResult = await analysisResponse.json();
      const analysisContent = analysisResult.choices?.[0]?.message?.content || "";
      try {
        const jsonStr = analysisContent.replace(/```json?\n?|\n?```/g, "").trim();
        callQualityScore = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("Error parsing quality analysis:", parseError);
      }
    }

    // 8) Persist (NÃO apagar áudio)
    const { error: updateError } = await supabase
      .from("receptive_attendances")
      .update({
        transcription,
        transcription_status: "completed",
        call_quality_score: callQualityScore,
      })
      .eq("id", attendanceId);

    if (updateError) {
      console.error("Error updating attendance:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, transcription, callQualityScore, energyConsumed: totalEnergyCost }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
