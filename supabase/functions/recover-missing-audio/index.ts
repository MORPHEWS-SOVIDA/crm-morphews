// One-shot recovery: re-download audio messages with NULL media_url via Evolution API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")!;
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

function extFromMime(m: string): string {
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mpeg")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("mp4")) return "m4a";
  return "bin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { hours = 24, limit = 100 } = await req.json().catch(() => ({}));
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();

    const { data: msgs, error } = await supabase
      .from("whatsapp_messages")
      .select("id, provider_message_id, instance_id, conversation_id, whatsapp_instances(evolution_instance_id, organization_id), whatsapp_conversations(phone_number)")
      .eq("message_type", "audio")
      .is("media_url", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    let ok = 0, fail = 0;
    const results: any[] = [];

    for (const m of msgs || []) {
      const inst: any = (m as any).whatsapp_instances;
      const conv: any = (m as any).whatsapp_conversations;
      if (!inst || !conv || !m.provider_message_id) { fail++; continue; }

      const phone = conv.phone_number as string;
      const remoteJid = phone.length > 15 ? `${phone}@g.us` : `${phone}@s.whatsapp.net`;

      try {
        const resp = await fetch(
          `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${inst.evolution_instance_id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
            body: JSON.stringify({
              message: { key: { id: m.provider_message_id, remoteJid, fromMe: false } },
              convertToMp4: false,
            }),
          }
        );
        if (!resp.ok) { fail++; results.push({ id: m.id, error: `evo ${resp.status}` }); continue; }
        const data = await resp.json();
        const b64 = data?.base64;
        const mime = (data?.mimetype || "audio/ogg").split(";")[0].trim();
        if (!b64) { fail++; results.push({ id: m.id, error: "no base64" }); continue; }

        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const ext = extFromMime(mime);
        const path = `orgs/${inst.organization_id}/instances/${m.instance_id}/${m.conversation_id}/${Date.now()}_${crypto.randomUUID().split("-")[0]}.${ext}`;

        const { error: upErr } = await supabase.storage.from("whatsapp-media").upload(path, bytes, {
          contentType: mime,
          upsert: true,
        });
        if (upErr) { fail++; results.push({ id: m.id, error: `upload ${upErr.message}` }); continue; }

        const proxyUrl = `${SUPABASE_URL}/functions/v1/media-proxy?path=${encodeURIComponent(path)}&mime=${encodeURIComponent(mime)}`;

        await supabase.from("whatsapp_messages").update({ media_url: proxyUrl }).eq("id", m.id);
        ok++;
        results.push({ id: m.id, size: bytes.length });
      } catch (e) {
        fail++;
        results.push({ id: m.id, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ total: msgs?.length || 0, ok, fail, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
