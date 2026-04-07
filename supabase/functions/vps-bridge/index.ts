/**
 * VPS Bridge — Proxy seguro para operações de banco de dados vindas da VPS.
 * Autenticado por VPS_BRIDGE_SECRET, usa service_role internamente.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bridge-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ────────────────────────────────────────────────
    // Accept secret via x-bridge-secret header OR Authorization: Bearer <secret>
    let secret = req.headers.get("x-bridge-secret");
    if (!secret) {
      const authHeader = req.headers.get("authorization") || "";
      if (authHeader.startsWith("Bearer ")) {
        secret = authHeader.slice(7);
      }
    }
    const expected = Deno.env.get("VPS_BRIDGE_SECRET");

    if (!expected || secret !== expected) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Supabase admin client ──────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Parse body ─────────────────────────────────────────
    const body = await req.json();
    const { action, table, schema, match, data, column, value, options, bucket, path: storagePath, rpc, args } = body;

    // ── Route actions ──────────────────────────────────────
    switch (action) {
      // ── SELECT ───────────────────────────────────────────
      case "select": {
        let query = supabase.from(table).select(column || "*");
        if (match) {
          for (const [k, v] of Object.entries(match)) {
            query = query.eq(k, v);
          }
        }
        if (options?.or) query = query.or(options.or);
        if (options?.order) {
          const { col, ascending } = options.order;
          query = query.order(col, { ascending: ascending ?? true });
        }
        if (options?.limit) query = query.limit(options.limit);
        // Use maybeSingle instead of single to avoid crashes when multiple rows match
        if (options?.single) query = query.maybeSingle();
        else if (options?.maybeSingle) query = query.maybeSingle();

        const { data: rows, error } = await query;
        if (error) throw error;
        return json({ data: rows });
      }

      // ── INSERT ───────────────────────────────────────────
      case "insert": {
        let query = supabase.from(table).insert(data);
        if (options?.select) query = query.select(options.select);
        if (options?.single) query = query.single();
        const { data: inserted, error } = await query;
        if (error) throw error;
        return json({ data: inserted });
      }

      // ── UPDATE ───────────────────────────────────────────
      case "update": {
        let query = supabase.from(table).update(data);
        if (match) {
          for (const [k, v] of Object.entries(match)) {
            query = query.eq(k, v);
          }
        }
        if (options?.select) query = query.select(options.select);
        if (options?.single) query = query.single();
        const { data: updated, error } = await query;
        if (error) throw error;
        return json({ data: updated });
      }

      // ── UPSERT ──────────────────────────────────────────
      case "upsert": {
        let query = supabase.from(table).upsert(data, {
          onConflict: options?.onConflict,
        });
        if (options?.select) query = query.select(options.select);
        if (options?.single) query = query.single();
        const { data: upserted, error } = await query;
        if (error) throw error;
        return json({ data: upserted });
      }

      // ── DELETE ──────────────────────────────────────────
      case "delete": {
        let query = supabase.from(table).delete();
        if (match) {
          for (const [k, v] of Object.entries(match)) {
            query = query.eq(k, v);
          }
        }
        const { data: deleted, error } = await query;
        if (error) throw error;
        return json({ data: deleted });
      }

      // ── RPC (database functions) ────────────────────────
      case "rpc": {
        const { data: rpcData, error } = await supabase.rpc(rpc, args || {});
        if (error) throw error;
        return json({ data: rpcData });
      }

      // ── STORAGE UPLOAD ──────────────────────────────────
      case "storage_upload": {
        const fileBody = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        const { data: uploadData, error } = await supabase.storage
          .from(bucket)
          .upload(storagePath, fileBody, {
            contentType: options?.contentType || "application/octet-stream",
            upsert: options?.upsert ?? true,
          });
        if (error) throw error;
        return json({ data: uploadData });
      }

      // ── STORAGE DOWNLOAD ────────────────────────────────
      case "storage_download": {
        const { data: blob, error } = await supabase.storage
          .from(bucket)
          .download(storagePath);
        if (error) throw error;
        const arrayBuffer = await blob!.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        return json({ data: base64 });
      }

      // ── STORAGE PUBLIC URL ──────────────────────────────
      case "storage_public_url": {
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(storagePath);
        return json({ data: urlData });
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
  } catch (err) {
    console.error("vps-bridge error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
