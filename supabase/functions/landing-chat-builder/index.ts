import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AI Provider: prefer GEMINI_API_KEY (direct), fallback to LOVABLE_API_KEY (gateway)
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const GEMINI_MODEL_MAP: Record<string, string> = {
  'google/gemini-3-flash-preview': 'gemini-2.0-flash',
  'google/gemini-2.5-flash': 'gemini-2.5-flash',
  'google/gemini-2.5-pro': 'gemini-2.5-pro',
};

function aiUrl() {
  return GEMINI_API_KEY
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    : 'https://ai.gateway.lovable.dev/v1/chat/completions';
}
function aiHeaders() {
  return { Authorization: `Bearer ${GEMINI_API_KEY || LOVABLE_API_KEY}`, 'Content-Type': 'application/json' };
}
function aiModel(m: string) {
  return GEMINI_API_KEY ? (GEMINI_MODEL_MAP[m] || 'gemini-2.0-flash') : m;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    
    if (!GEMINI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("No AI API key configured");
    }

    console.log(`[landing-chat-builder] Processing ${messages.length} messages`);

    const response = await fetch(aiUrl(), {
      method: "POST",
      headers: aiHeaders(),
      body: JSON.stringify({
        model: aiModel("google/gemini-3-flash-preview"),
        messages,
        stream: true,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[landing-chat-builder] AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Add credits to your account." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("[landing-chat-builder] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
