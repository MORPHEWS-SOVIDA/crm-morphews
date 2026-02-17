import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { prefix, bucket, limit = 500 } = await req.json();
    if (!prefix || !bucket) {
      return new Response(JSON.stringify({ error: "prefix and bucket required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Query storage.objects directly to get file names
    const { data: rows, error: qErr } = await supabase
      .from("objects" as any)
      .select("name")
      .eq("bucket_id", bucket)
      .like("name", `${prefix}%`)
      .limit(limit);

    // Fallback: use RPC or raw approach
    // Actually we need to use storage API. Let's get paths from a custom query approach.
    // Since we can't query storage.objects via postgrest easily, let's use the known pattern
    // and delete by listing each subdir quickly

    let totalDeleted = 0;
    const start = Date.now();

    // Get all unique subdirs via a workaround - just try listing the parent
    const { data: items } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    
    if (items && items.length > 0) {
      for (const item of items) {
        if (Date.now() - start > 45000) break;
        
        if (item.id) {
          // It's a file - delete directly
          const { error } = await supabase.storage.from(bucket).remove([`${prefix}/${item.name}`]);
          if (!error) totalDeleted++;
        } else {
          // It's a folder - list and delete contents
          const subPath = `${prefix}/${item.name}`;
          let hasMore = true;
          while (hasMore && (Date.now() - start < 45000)) {
            const { data: files } = await supabase.storage.from(bucket).list(subPath, { limit: 100 });
            if (!files || files.length === 0) { hasMore = false; break; }
            const paths = files.filter(f => f.id).map(f => `${subPath}/${f.name}`);
            if (paths.length === 0) { hasMore = false; break; }
            const { error } = await supabase.storage.from(bucket).remove(paths);
            if (!error) totalDeleted += paths.length;
            if (files.length < 100) hasMore = false;
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, totalDeleted, elapsedMs: Date.now() - start }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
