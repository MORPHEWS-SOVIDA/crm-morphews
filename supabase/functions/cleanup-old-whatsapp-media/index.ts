// One-off cleanup: remove WhatsApp media files older than N days from storage.
// Uses service-role to call Storage API in batches.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") ?? "60");
  const dryRun = url.searchParams.get("dry_run") === "1";
  const bucket = url.searchParams.get("bucket") ?? "whatsapp-media";
  const batchSize = Math.min(Number(url.searchParams.get("batch") ?? "500"), 1000);
  const maxBatches = Number(url.searchParams.get("max_batches") ?? "999");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const cutoffISO = new Date(Date.now() - days * 86_400_000).toISOString();
  let totalDeleted = 0;
  let totalSize = 0;
  let batches = 0;
  const errors: string[] = [];

  try {
    while (batches < maxBatches) {
      // Pull a batch of old object names via SECURITY DEFINER RPC (storage.objects is not exposed via PostgREST)
      const { data: rows, error: selErr } = await supabase
        .rpc("get_old_whatsapp_media_names", { p_days: days, p_limit: batchSize });

      if (selErr) { errors.push("rpc: " + selErr.message); break; }
      if (!rows || rows.length === 0) break;

      const names = rows.map((r: any) => r.name).filter(Boolean);
      const sizeBytes = rows.reduce((s: number, r: any) => s + Number(r.size_bytes ?? 0), 0);

      if (dryRun) {
        totalDeleted += names.length;
        totalSize += sizeBytes;
        batches++;
        // For dry-run we stop after the first batch so we don't loop forever on the same rows
        break;
      }

      // Storage API supports bulk remove
      const { data: removed, error: rmErr } = await supabase.storage.from(bucket).remove(names);
      if (rmErr) {
        errors.push(`remove batch ${batches}: ${rmErr.message}`);
        break;
      }

      totalDeleted += removed?.length ?? 0;
      totalSize += sizeBytes;
      batches++;

      // Tiny pause to avoid hammering the storage backend
      await new Promise((r) => setTimeout(r, 50));
    }

    // Also clear media_url on old messages so the UI doesn't try to load dead links
    if (!dryRun) {
      await supabase
        .from("whatsapp_messages")
        .update({ media_url: null })
        .lt("created_at", cutoffISO)
        .not("media_url", "is", null);
    }
  } catch (e: any) {
    errors.push("fatal: " + (e?.message ?? String(e)));
  }

  return new Response(
    JSON.stringify({
      ok: errors.length === 0,
      dry_run: dryRun,
      days,
      bucket,
      batches,
      deleted: totalDeleted,
      freed_mb: Math.round(totalSize / 1024 / 1024),
      errors,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
});
