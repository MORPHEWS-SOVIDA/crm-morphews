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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMatch(
  action: string | undefined,
  body: Record<string, unknown>,
  options: Record<string, unknown> | undefined,
  column: unknown,
  value: unknown,
) {
  const rawMatch = body.match ?? options?.match ?? body.filter ?? body.filters ?? body.where ?? body.criteria ?? body.query ?? body.eq;

  if (isPlainObject(rawMatch)) {
    const key = typeof rawMatch.column === "string"
      ? rawMatch.column
      : typeof rawMatch.field === "string"
      ? rawMatch.field
      : typeof rawMatch.key === "string"
      ? rawMatch.key
      : null;
    const compactValue = rawMatch.value ?? rawMatch.eq;

    if (key && compactValue !== undefined) {
      return { [key]: compactValue };
    }

    return Object.keys(rawMatch).length > 0 ? rawMatch : null;
  }

  if (Array.isArray(rawMatch)) {
    const fromArray = rawMatch.reduce<Record<string, unknown>>((acc, item) => {
      if (!isPlainObject(item)) return acc;
      const key = typeof item.column === "string"
        ? item.column
        : typeof item.field === "string"
        ? item.field
        : typeof item.key === "string"
        ? item.key
        : null;
      const itemValue = item.value ?? item.eq;
      if (key && itemValue !== undefined) acc[key] = itemValue;
      return acc;
    }, {});
      if (Object.keys(fromArray).length > 0) return fromArray;
  }

  // column/value as filter — works for ALL actions including select
  if (typeof column === "string" && value !== undefined) {
    return { [column]: value };
  }

  if (
    typeof body.whereColumn === "string" &&
    body.whereValue !== undefined
  ) {
    return { [body.whereColumn]: body.whereValue };
  }

  if (body.id !== undefined) {
    return { id: body.id };
  }

  if (isPlainObject(body.data) && body.data.id !== undefined) {
    return { id: body.data.id };
  }

  if (body.recordId !== undefined) {
    return { id: body.recordId };
  }

  return null;
}

function applyMatchFilters<T>(query: T, match: Record<string, unknown> | null): T {
  let nextQuery: any = query;

  if (!match) return nextQuery;

  for (const [k, v] of Object.entries(match)) {
    // Handle PostgREST-style keys: "eq.column_name", "in.column_name", "is.column_name"
    const dotIdx = k.indexOf(".");
    if (dotIdx > 0) {
      const operator = k.slice(0, dotIdx);
      const col = k.slice(dotIdx + 1);
      switch (operator) {
        case "eq":
          nextQuery = nextQuery.eq(col, v);
          break;
        case "neq":
          nextQuery = nextQuery.neq(col, v);
          break;
        case "gt":
          nextQuery = nextQuery.gt(col, v);
          break;
        case "gte":
          nextQuery = nextQuery.gte(col, v);
          break;
        case "lt":
          nextQuery = nextQuery.lt(col, v);
          break;
        case "lte":
          nextQuery = nextQuery.lte(col, v);
          break;
        case "like":
          nextQuery = nextQuery.like(col, v);
          break;
        case "ilike":
          nextQuery = nextQuery.ilike(col, v);
          break;
        case "is":
          nextQuery = nextQuery.is(col, v);
          break;
        case "in":
          nextQuery = nextQuery.in(col, Array.isArray(v) ? v : [v]);
          break;
        default:
          // Unknown operator, treat as eq
          nextQuery = nextQuery.eq(col, v);
      }
    } else if (Array.isArray(v)) {
      nextQuery = nextQuery.in(k, v);
    } else if (v === null) {
      nextQuery = nextQuery.is(k, null);
    } else {
      nextQuery = nextQuery.eq(k, v);
    }
  }

  return nextQuery;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

    // Debug: log incoming request to diagnose VPS payload format
    console.log("vps-bridge incoming:", JSON.stringify({
      action: body.action,
      table: body.table,
      column: body.column,
      value: body.value,
      select: body.select,
      match: body.match,
      eq: body.eq,
      filters: body.filters,
      filter: body.filter,
      options: body.options,
      keys: Object.keys(body),
    }));

    const {
      action,
      table,
      schema,
      data,
      column,
      value,
      options,
      bucket,
      path: storagePath,
      args,
    } = body;
    const normalizedOptions = isPlainObject(options) ? options : undefined;
    const normalizedMatch = normalizeMatch(action, body, normalizedOptions, column, value);
    const rpcName = body.rpc ?? body.function ?? body.functionName ?? body.fn ?? body.procedure ?? body.rpcName ?? body.name ?? (action === "rpc" || action === "call_rpc" ? table : undefined);
    const rpcArgs = isPlainObject(args)
      ? args
      : isPlainObject(body.params)
      ? body.params
      : isPlainObject(body.payload)
      ? body.payload
      : isPlainObject(data)
      ? data
      : {};
    const db = schema && schema !== "public" ? supabase.schema(schema) : supabase;

    // ── Route actions ──────────────────────────────────────
    switch (action) {
      // ── SELECT ───────────────────────────────────────────
      case "select": {
        // Use body.select or options.select for columns; never use column (that's for filtering)
        const selectCols = typeof body.select === "string" ? body.select
          : typeof normalizedOptions?.select === "string" ? String(normalizedOptions.select)
          : typeof normalizedOptions?.columns === "string" ? String(normalizedOptions.columns)
          : "*";
        
        console.log("vps-bridge SELECT debug:", JSON.stringify({
          table,
          selectCols,
          normalizedMatch,
          or: normalizedOptions?.or,
          order: normalizedOptions?.order,
          limit: normalizedOptions?.limit,
          wantSingle: !!(normalizedOptions?.single || normalizedOptions?.maybeSingle),
        }));
        
        let query = db.from(table).select(selectCols);
        query = applyMatchFilters(query, normalizedMatch);
        if (normalizedOptions?.or) query = query.or(String(normalizedOptions.or));
        if (isPlainObject(normalizedOptions?.order)) {
          const { col, ascending } = normalizedOptions.order;
          query = query.order(col, { ascending: ascending ?? true });
        }
        if (typeof normalizedOptions?.limit === "number") query = query.limit(normalizedOptions.limit);
        
        const wantSingle = normalizedOptions?.single || normalizedOptions?.maybeSingle;
        // When caller wants a single row, use limit(1) instead of .single()
        // to avoid PGRST116 errors when multiple rows match
        if (wantSingle) query = query.limit(1);

        const { data: rows, error } = await query;
        if (error) throw error;
        
        if (wantSingle) {
          const result = Array.isArray(rows) ? (rows[0] ?? null) : rows;
          return json({ data: result });
        }
        return json({ data: rows });
      }

      // ── INSERT ───────────────────────────────────────────
      case "insert": {
        let query = db.from(table).insert(data);
        if (typeof normalizedOptions?.select === "string") query = query.select(normalizedOptions.select);
        if (normalizedOptions?.single) query = query.single();
        const { data: inserted, error } = await query;
        if (error) throw error;
        return json({ data: inserted });
      }

      // ── UPDATE ───────────────────────────────────────────
      case "update": {
        if (!normalizedMatch) {
          console.warn("vps-bridge update rejected: missing match filters", {
            table,
            receivedKeys: Object.keys(body),
          });
          return json({
            error: "Update requires match filters",
            action,
            table,
            received_keys: Object.keys(body),
          }, 400);
        }
        let query = db.from(table).update(data);
        query = applyMatchFilters(query, normalizedMatch);
        if (typeof normalizedOptions?.select === "string") query = query.select(normalizedOptions.select);
        if (normalizedOptions?.single) query = query.single();
        const { data: updated, error } = await query;
        if (error) throw error;
        return json({ data: updated });
      }

      // ── UPSERT ──────────────────────────────────────────
      case "upsert": {
        let query = db.from(table).upsert(data, {
          onConflict: typeof normalizedOptions?.onConflict === "string" ? normalizedOptions.onConflict : undefined,
        });
        if (typeof normalizedOptions?.select === "string") query = query.select(normalizedOptions.select);
        if (normalizedOptions?.single) query = query.single();
        const { data: upserted, error } = await query;
        if (error) throw error;
        return json({ data: upserted });
      }

      // ── DELETE ──────────────────────────────────────────
      case "delete": {
        if (!normalizedMatch) {
          console.warn("vps-bridge delete rejected: missing match filters", {
            table,
            receivedKeys: Object.keys(body),
          });
          return json({
            error: "Delete requires match filters",
            action,
            table,
            received_keys: Object.keys(body),
          }, 400);
        }
        let query = db.from(table).delete();
        query = applyMatchFilters(query, normalizedMatch);
        const { data: deleted, error } = await query;
        if (error) throw error;
        return json({ data: deleted });
      }

      // ── RPC (database functions) ────────────────────────
      case "call_rpc":
      case "rpc": {
        if (typeof rpcName !== "string" || !rpcName.trim()) {
          console.warn("vps-bridge rpc rejected: missing function name", {
            receivedKeys: Object.keys(body),
          });
          return json({
            error: "RPC function name is required",
            action,
            received_keys: Object.keys(body),
          }, 400);
        }
        const { data: rpcData, error } = await db.rpc(rpcName, rpcArgs);
        if (error) throw error;
        return json({ data: rpcData });
      }

      // ── STORAGE UPLOAD ──────────────────────────────────
      case "storage_upload": {
        const fileBody = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        const { data: uploadData, error } = await supabase.storage
          .from(bucket)
          .upload(storagePath, fileBody, {
            contentType: normalizedOptions?.contentType || "application/octet-stream",
            upsert: normalizedOptions?.upsert ?? true,
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
    return json({ error: String(err) }, 500);
  }
});
