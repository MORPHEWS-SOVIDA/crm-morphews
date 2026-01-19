import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TranscribeRequest {
  attendanceId: string;
  audioUrl: string;
  storagePath?: string; // If provided, delete from storage after transcription
}

interface CallQualityScore {
  // Individual scores 1-10
  proper_greeting_score: number;
  asked_needs_score: number;
  followed_script_score: number;
  offered_kits_score: number;
  handled_objections_score: number;
  clear_next_steps_score: number;
  // Overall
  overall_score: number;
  summary: string;
  improvements: string[];
}

const ENERGY_COST_TRANSCRIPTION = 50; // Base cost for transcription
const ENERGY_COST_ANALYSIS = 20; // Cost for quality analysis

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { attendanceId, audioUrl, storagePath }: TranscribeRequest = await req.json();

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

    // Get the attendance to find the organization_id
    const { data: attendance, error: attendanceError } = await supabase
      .from("receptive_attendances")
      .select("organization_id")
      .eq("id", attendanceId)
      .single();

    if (attendanceError || !attendance) {
      return new Response(
        JSON.stringify({ error: "Attendance not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const organizationId = attendance.organization_id;

    // Check and consume energy for transcription
    const totalEnergyCost = ENERGY_COST_TRANSCRIPTION + ENERGY_COST_ANALYSIS;
    const { data: energyResult, error: energyError } = await supabase.rpc('consume_energy', {
      p_organization_id: organizationId,
      p_bot_id: null,
      p_conversation_id: null,
      p_action_type: 'call_transcription',
      p_energy_amount: totalEnergyCost,
      p_tokens_used: null,
      p_details: { 
        attendance_id: attendanceId,
        timestamp: new Date().toISOString() 
      },
    });

    if (energyError) {
      console.error('Energy consumption error:', energyError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar energia. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if energy was sufficient
    const energyOk = typeof energyResult === 'boolean' ? energyResult : (energyResult?.success ?? true);
    if (!energyOk) {
      return new Response(
        JSON.stringify({ 
          error: "Energia insuficiente para transcrição. Entre em contato com o administrador.",
          available_energy: energyResult?.available_energy,
          required_energy: totalEnergyCost
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`⚡ Energy consumed: ${totalEnergyCost} for org ${organizationId}`);

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

    // Step 2: Analyze call quality with individual scores
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
            content: `Você é um analista de qualidade de vendas. Analise a transcrição de uma ligação de vendas e avalie cada critério com uma nota de 1 a 10.
Retorne APENAS um JSON válido sem markdown ou explicações adicionais.`
          },
          {
            role: "user",
            content: `Analise esta transcrição de ligação de vendas e retorne um JSON com notas de 1-10 para cada critério:

{
  "proper_greeting_score": number 1-10 (saudação adequada e profissional?),
  "asked_needs_score": number 1-10 (vendedor perguntou sobre necessidades do cliente?),
  "followed_script_score": number 1-10 (vendedor seguiu um script estruturado?),
  "offered_kits_score": number 1-10 (vendedor ofereceu kits/produtos promocionais?),
  "handled_objections_score": number 1-10 (vendedor lidou bem com objeções?),
  "clear_next_steps_score": number 1-10 (próximos passos ficaram claros?),
  "overall_score": number 1-10 (nota geral calculada como média ponderada),
  "summary": string (resumo de 2-3 frases da ligação),
  "improvements": string[] (lista de melhorias sugeridas, max 3)
}

Critérios de avaliação:
- 1-3: Muito fraco, não realizado ou muito mal executado
- 4-5: Abaixo do esperado, precisa melhorar significativamente  
- 6-7: Adequado, mas com espaço para melhoria
- 8-9: Bom, bem executado
- 10: Excelente, exemplar

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
        // Clear the recording URL after transcription if it was from storage
        // (we keep transcription, don't need the audio anymore)
        call_recording_url: storagePath ? null : undefined,
      })
      .eq("id", attendanceId);

    if (updateError) {
      console.error("Error updating attendance:", updateError);
      throw updateError;
    }

    // Delete the audio file from storage if it was uploaded (not an external URL)
    if (storagePath) {
      try {
        console.log(`🗑️ Deleting audio file from storage: ${storagePath}`);
        const { error: deleteError } = await supabase.storage
          .from('receptive-recordings')
          .remove([storagePath]);
        
        if (deleteError) {
          console.error('Error deleting audio file:', deleteError);
          // Don't throw - transcription was successful, deletion is cleanup
        } else {
          console.log(`✅ Audio file deleted successfully: ${storagePath}`);
        }
      } catch (deleteErr) {
        console.error('Error in deletion process:', deleteErr);
        // Continue - transcription was successful
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcription,
        callQualityScore,
        energyConsumed: totalEnergyCost,
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
