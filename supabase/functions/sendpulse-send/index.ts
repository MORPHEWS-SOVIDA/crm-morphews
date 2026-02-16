import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SENDPULSE_CLIENT_ID = Deno.env.get("SENDPULSE_CLIENT_ID") ?? "";
const SENDPULSE_CLIENT_SECRET = Deno.env.get("SENDPULSE_CLIENT_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Cache token in memory (valid ~1h)
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getSendPulseToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  console.log("🔑 Fetching new SendPulse token...");

  const res = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: SENDPULSE_CLIENT_ID,
      client_secret: SENDPULSE_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SendPulse auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Expire 5 min before actual expiry
  tokenExpiresAt = Date.now() + ((data.expires_in || 3600) - 300) * 1000;

  console.log("🔑 SendPulse token obtained, expires in:", data.expires_in, "s");
  return cachedToken!;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SENDPULSE_CLIENT_ID || !SENDPULSE_CLIENT_SECRET) {
      throw new Error("SENDPULSE_CLIENT_ID and SENDPULSE_CLIENT_SECRET are required");
    }

    const { conversationId, content, contactId } = await req.json();

    if (!conversationId || !content) {
      throw new Error("conversationId and content are required");
    }

    console.log("📤 SendPulse send:", { conversationId, contentLen: content.length });

    // Get conversation to find the SendPulse contact_id
    const { data: convo, error: convoErr } = await supabase
      .from("whatsapp_conversations")
      .select("id, phone_number, instance_id, organization_id, channel_type, chat_id")
      .eq("id", conversationId)
      .single();

    if (convoErr || !convo) {
      throw new Error("Conversation not found");
    }

    // The phone_number field stores the SendPulse contact_id for Instagram convos
    const spContactId = contactId || convo.phone_number;
    if (!spContactId) {
      throw new Error("SendPulse contact_id not found");
    }

    // Get SendPulse token
    const token = await getSendPulseToken();

    // Send message via SendPulse Instagram API
    const sendRes = await fetch("https://api.sendpulse.com/instagram/contacts/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        contact_id: spContactId,
        message: {
          type: "text",
          text: {
            text: content,
          },
        },
      }),
    });

    const sendData = await sendRes.json();
    console.log("📤 SendPulse response:", { status: sendRes.status, data: sendData });

    if (!sendRes.ok) {
      throw new Error(sendData?.message || sendData?.error || `SendPulse API error (${sendRes.status})`);
    }

    // Save outbound message
    const newMsgId = crypto.randomUUID();
    const { data: msg, error: msgErr } = await supabase
      .from("whatsapp_messages")
      .insert({
        id: newMsgId,
        instance_id: convo.instance_id,
        conversation_id: convo.id,
        message_type: "text",
        content: content,
        direction: "outbound",
        status: "sent",
        is_from_bot: false,
        provider: "sendpulse",
        provider_message_id: sendData?.id || `sp_out_${Date.now()}`,
      })
      .select()
      .single();

    if (msgErr) {
      console.error("📤 Error saving outbound message:", msgErr);
      throw new Error("Message sent but failed to save in database");
    }

    // Update conversation
    await supabase.from("whatsapp_conversations").update({
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    }).eq("id", convo.id);

    console.log("📤 Message sent and saved:", newMsgId);

    return new Response(JSON.stringify({ ok: true, message: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("📤 sendpulse-send error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
