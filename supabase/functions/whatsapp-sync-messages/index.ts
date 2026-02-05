import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractTextContent(message: any): { content: string | null; messageType: string } {
  if (!message) return { content: null, messageType: "text" };

  if (typeof message.conversation === "string") {
    return { content: message.conversation, messageType: "text" };
  }

  if (typeof message.extendedTextMessage?.text === "string") {
    return { content: message.extendedTextMessage.text, messageType: "text" };
  }

  // Ephemeral wrapper (common on some accounts)
  if (message.ephemeralMessage?.message) {
    return extractTextContent(message.ephemeralMessage.message);
  }

  return { content: "[mídia]", messageType: "text" };
}

function extractCreatedAt(msg: any): string | undefined {
  const ts = msg?.messageTimestamp ?? msg?.message_timestamp ?? msg?.timestamp;

  // number in seconds
  if (typeof ts === "number" && Number.isFinite(ts)) {
    return new Date(ts * 1000).toISOString();
  }

  // string number
  if (typeof ts === "string" && ts.trim() && !Number.isNaN(Number(ts))) {
    return new Date(Number(ts) * 1000).toISOString();
  }

  // protobuf-like { low, high }
  if (typeof ts === "object" && ts && typeof ts.low === "number") {
    return new Date(ts.low * 1000).toISOString();
  }

  return undefined;
}

async function evolutionFindMessages(params: {
  instanceName: string;
  remoteJid: string;
  limit: number;
}) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    throw new Error("Evolution API não configurada");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/chat/findMessages/${encodeURIComponent(params.instanceName)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        where: {
          key: {
            remoteJid: params.remoteJid,
          },
        },
        limit: params.limit,
        page: 1,
        offset: 0,
      }),
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") || "";

    // Some deployments return empty body; handle gracefully.
    const raw = await res.text().catch(() => "");

    if (!res.ok) {
      const preview = raw.slice(0, 300);
      throw new Error(`Evolution API erro (${res.status}): ${preview || "sem corpo"}`);
    }

    if (!raw) return [];

    if (!contentType.includes("application/json")) {
      // Try JSON anyway; fallback empty
      try {
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : (parsed?.messages || parsed?.data || []);
        return Array.isArray(items) ? items : [];
      } catch {
        return [];
      }
    }

    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : (parsed?.messages || parsed?.data || []);
    return Array.isArray(items) ? items : [];
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!jwt) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    const user = userData?.user;
    if (userErr || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const conversationId = String(body?.conversationId || "").trim();
    const limit = Math.min(Math.max(Number(body?.limit || 80), 10), 200);

    if (!conversationId) {
      return jsonResponse({ error: "conversationId obrigatório" }, 400);
    }

    // Fetch conversation
    const { data: convo, error: convoErr } = await supabaseAdmin
      .from("whatsapp_conversations")
      .select("id, organization_id, instance_id, chat_id")
      .eq("id", conversationId)
      .single();

    if (convoErr || !convo) return jsonResponse({ error: "Conversa não encontrada" }, 404);

    // Verify membership
    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", convo.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) return jsonResponse({ error: "Forbidden" }, 403);

    // Get instance name for Evolution
    const { data: inst } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("evolution_instance_id")
      .eq("id", convo.instance_id)
      .single();

    const instanceName = inst?.evolution_instance_id;
    if (!instanceName || !convo.chat_id) {
      return jsonResponse({ error: "Instância/chat_id não configurados" }, 400);
    }

    const messages = await evolutionFindMessages({
      instanceName,
      remoteJid: convo.chat_id,
      limit,
    });

    const ids = messages
      .map((m: any) => (typeof m?.key?.id === "string" ? m.key.id : null))
      .filter(Boolean) as string[];

    if (ids.length === 0) {
      return jsonResponse({ ok: true, synced: 0, reason: "no_ids" });
    }

    const { data: existing } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("provider_message_id")
      .eq("conversation_id", convo.id)
      .in("provider_message_id", ids);

    const existingSet = new Set((existing || []).map((r: any) => r.provider_message_id).filter(Boolean));

    const toInsert = messages
      .filter((m: any) => typeof m?.key?.id === "string")
      .filter((m: any) => !existingSet.has(m.key.id))
      // Focus on customer replies (missing inbound); outbound are already handled by send pipeline
      .filter((m: any) => m?.key?.fromMe !== true)
      .map((m: any) => {
        const { content, messageType } = extractTextContent(m?.message);
        const createdAt = extractCreatedAt(m);

        return {
          conversation_id: convo.id,
          instance_id: convo.instance_id,
          direction: "inbound",
          content,
          message_type: messageType,
          provider: "evolution",
          provider_message_id: m.key.id,
          ...(createdAt ? { created_at: createdAt } : {}),
        };
      });

    if (toInsert.length === 0) {
      return jsonResponse({ ok: true, synced: 0, reason: "nothing_to_insert" });
    }

    const { error: insErr } = await supabaseAdmin.from("whatsapp_messages").insert(toInsert);
    if (insErr) throw insErr;

    // Update conversation metadata best-effort
    const newest = toInsert
      .map((r: any) => r.created_at)
      .filter(Boolean)
      .sort()
      .at(-1);

    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({
        last_message_at: newest || new Date().toISOString(),
        last_customer_message_at: newest || new Date().toISOString(),
        unread_count: 1,
      })
      .eq("id", convo.id);

    return jsonResponse({ ok: true, synced: toInsert.length });
  } catch (e: any) {
    console.error("whatsapp-sync-messages error:", e);
    return jsonResponse({ error: e?.message || "Erro" }, 500);
  }
});
