import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TranscribeRequest {
  attendanceId: string;
  audioUrl: string;
}

interface CallQualityScore {
  followed_script: boolean;
  offered_kits: boolean;
  proper_greeting: boolean;
  asked_needs: boolean;
  handled_objections: boolean;
  clear_next_steps: boolean;
  overall_score: number;
  summary: string;
  improvements: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { attendanceId, audioUrl }: TranscribeRequest = await req.json();

    if (!attendanceId || !audioUrl) {
      return new Response(
        JSON.stringify({ error: "attendanceId and audioUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update status to processing
    await supabase
      .from("receptive_attendances")
      .update({ transcription_status: "processing" })
      .eq("id", attendanceId);

    // Download audio file
    let audioBase64: string;
    try {
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
      }
      const audioBuffer = await audioResponse.arrayBuffer();
      audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
    } catch (audioError) {
      console.error("Error fetching audio:", audioError);
      await supabase
        .from("receptive_attendances")
        .update({ transcription_status: "failed" })
        .eq("id", attendanceId);
      throw new Error("Could not fetch audio file");
    }

    // Step 1: Transcribe with Gemini (multimodal)
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
            content: `Você é um transcriptor especializado em ligações de vendas em português brasileiro. 
Transcreva o áudio de forma precisa, identificando diferentes falantes quando possível (Vendedor, Cliente).
Formate a transcrição de forma clara com quebras de linha entre as falas.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Por favor, transcreva esta ligação de vendas:"
              },
              {
                type: "input_audio",
                input_audio: {
                  data: audioBase64,
                  format: "mp3"
                }
              }
            ]
          }
        ],
      }),
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error("Transcription API error:", transcriptionResponse.status, errorText);
      
      await supabase
        .from("receptive_attendances")
        .update({ transcription_status: "failed" })
        .eq("id", attendanceId);
        
      if (transcriptionResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (transcriptionResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Transcription failed");
    }

    const transcriptionResult = await transcriptionResponse.json();
    const transcription = transcriptionResult.choices?.[0]?.message?.content || "";

    // Step 2: Analyze call quality
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
            content: `Você é um analista de qualidade de vendas. Analise a transcrição de uma ligação de vendas e avalie os seguintes critérios.
Retorne APENAS um JSON válido sem markdown ou explicações adicionais.`
          },
          {
            role: "user",
            content: `Analise esta transcrição de ligação de vendas e retorne um JSON com a seguinte estrutura:
{
  "followed_script": boolean (vendedor seguiu um script estruturado?),
  "offered_kits": boolean (vendedor ofereceu kits/produtos promocionais?),
  "proper_greeting": boolean (saudação adequada e profissional?),
  "asked_needs": boolean (vendedor perguntou sobre necessidades do cliente?),
  "handled_objections": boolean (vendedor lidou bem com objeções?),
  "clear_next_steps": boolean (próximos passos ficaram claros?),
  "overall_score": number 1-10 (nota geral da ligação),
  "summary": string (resumo de 2-3 frases da ligação),
  "improvements": string[] (lista de melhorias sugeridas, max 3)
}

Transcrição:
${transcription}`
          }
        ],
      }),
    });

    let callQualityScore: CallQualityScore | null = null;
    
    if (analysisResponse.ok) {
      const analysisResult = await analysisResponse.json();
      const analysisContent = analysisResult.choices?.[0]?.message?.content || "";
      
      try {
        // Remove markdown code blocks if present
        const jsonStr = analysisContent.replace(/```json?\n?|\n?```/g, "").trim();
        callQualityScore = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("Error parsing quality analysis:", parseError);
        // Continue without quality score
      }
    }

    // Update the attendance record
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
      JSON.stringify({
        success: true,
        transcription,
        callQualityScore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
