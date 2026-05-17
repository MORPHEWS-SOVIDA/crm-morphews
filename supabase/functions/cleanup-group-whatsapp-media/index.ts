// One-off cleanup: remove WhatsApp media files belonging to GROUP conversations.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const bucket = url.searchParams.get("bucket") ?? "whatsapp-media";
  const batchSize = Math.min(Number(url.searchParams.get("batch") ?? "500"), 1000);
  const maxBatches = Number(url.searchParams.get("max_batches") ?? "999");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let totalDeleted = 0;
  let totalSize = 0;
  let batches = 0;
  const errors: string[] = [];

  try {
    while (batches < maxBatches) {
      const { data: rows, error: selErr } = await supabase
        .rpc("get_group_whatsapp_media_names", { p_limit: batchSize });
      if (selErr) { errors.push("rpc: " + selErr.message); break; }
      if (!rows || rows.length === 0) break;

      const names = rows.map((r: any) => r.name).filter(Boolean);
      const sizeBytes = rows.reduce((s: number, r: any) => s + Number(r.size_bytes ?? 0), 0);

      if (dryRun) {
        totalDeleted += names.length;
        totalSize += sizeBytes;
        batches++;
        break;
      }

      const { data: removed, error: rmErr } = await supabase.storage.from(bucket).remove(names);
      if (rmErr) { errors.push(`remove batch ${batches}: ${rmErr.message}`); break; }

      totalDeleted += removed?.length ?? 0;
      totalSize += sizeBytes;
      batches++;
      await new Promise((r) => setTimeout(r, 50));
    }

    if (!dryRun) {
      // Clear media_url on messages from group conversations
      await supabase.rpc("clear_group_media_urls").catch(() => null);
    }
  } catch (e: any) {
    errors.push("fatal: " + (e?.message ?? String(e)));
  }

  return new Response(
    JSON.stringify({
      ok: errors.length === 0,
      dry_run: dryRun,
      bucket,
      batches,
      deleted: totalDeleted,
      freed_mb: Math.round(totalSize / 1024 / 1024),
      errors,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
});
