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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function digitsOnly(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function toRemoteJid(value: unknown): string | null {
  const raw = firstNonEmptyString(value);
  if (!raw) return null;
  if (raw.includes("@")) return raw;
  const digits = digitsOnly(raw);
  return digits ? `${digits}@s.whatsapp.net` : null;
}

function getMediaMessageId(data: Record<string, unknown>): string | null {
  return firstNonEmptyString(
    data.external_id,
    data.externalId,
    data.provider_message_id,
    data.providerMessageId,
    data.z_api_message_id,
    data.zApiMessageId,
    data.message_id,
    data.messageId,
    data.key_id,
    data.keyId,
  );
}

async function resolveConversationContext(supabase: any, conversationId: string) {
  const { data: convRows, error: convError } = await supabase
    .from("whatsapp_conversations")
    .select("instance_id, organization_id, phone_number, sendable_phone, customer_phone_e164, chat_id")
    .eq("id", conversationId)
    .limit(1);

  if (convError) {
    console.error("❌ Failed to load conversation context:", convError);
    return null;
  }

  const conversation = Array.isArray(convRows) ? convRows[0] : convRows;
  if (!conversation?.instance_id || !conversation?.organization_id) {
    console.error("❌ No conversation context found for ID:", conversationId);
    return null;
  }

  const { data: instRows, error: instError } = await supabase
    .from("whatsapp_instances")
    .select("name")
    .eq("id", conversation.instance_id)
    .limit(1);

  if (instError) {
    console.error("❌ Failed to load instance context:", instError);
    return null;
  }

  const instance = Array.isArray(instRows) ? instRows[0] : instRows;
  if (!instance?.name) {
    console.error("❌ No instance found for ID:", conversation.instance_id);
    return null;
  }

  const remoteJid = toRemoteJid(conversation.chat_id)
    ?? toRemoteJid(conversation.customer_phone_e164)
    ?? toRemoteJid(conversation.sendable_phone)
    ?? toRemoteJid(conversation.phone_number);

  const senderPhone = digitsOnly(
    conversation.customer_phone_e164
      ?? conversation.sendable_phone
      ?? conversation.phone_number
      ?? conversation.chat_id,
  );

  return {
    organizationId: conversation.organization_id as string,
    instanceId: conversation.instance_id as string,
    instanceName: instance.name as string,
    remoteJid,
    senderPhone,
  };
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/opus": "opus",
    "video/mp4": "mp4", "video/3gpp": "3gp",
    "application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  return map[mime.split(";")[0].trim()] || "bin";
}

async function processMediaBase64(
  supabase: any,
  base64Data: string,
  mimeType: string,
  conversationId: string,
  organizationId?: string | null,
): Promise<string | null> {
  try {
    const fallbackContext = organizationId
      ? null
      : await resolveConversationContext(supabase, conversationId);
    const resolvedOrganizationId = firstNonEmptyString(
      organizationId,
      fallbackContext?.organizationId,
    );

    if (!resolvedOrganizationId) {
      console.error("❌ Could not resolve organization_id for media upload:", { conversationId });
      return null;
    }

    let rawBase64 = base64Data;
    if (rawBase64.includes(",") && rawBase64.startsWith("data:")) {
      rawBase64 = rawBase64.split(",")[1];
    }
    rawBase64 = rawBase64.replace(/\s/g, "").replace(/[^A-Za-z0-9+/=]/g, "");
    while (rawBase64.length % 4 !== 0) rawBase64 += "=";
    
    const fileBody = Uint8Array.from(atob(rawBase64), (c) => c.charCodeAt(0));
    const ext = extFromMime(mimeType);
    const timestamp = Date.now();
    const random = crypto.randomUUID().split("-")[0];
    const storagePath = `orgs/${resolvedOrganizationId}/conversations/${conversationId}/${timestamp}_${random}.${ext}`;
    
    const cleanMime = mimeType.split(";")[0].trim();
    
    const { error } = await supabase.storage
      .from("whatsapp-media")
      .upload(storagePath, fileBody, { contentType: cleanMime, upsert: true });
    
    if (error) {
      console.error("❌ Media upload failed:", error);
      return null;
    }
    
    const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(storagePath);
    return urlData?.publicUrl || null;
  } catch (err) {
    console.error("❌ processMediaBase64 error:", err);
    return null;
  }
}

async function downloadAndStoreMedia(
  supabase: any,
  conversationId: string,
  externalId: string,
  messageType: string,
  senderPhone?: string,
  direction?: string,
): Promise<string | null> {
  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.log("📹 No Evolution API credentials, skipping media download");
      return null;
    }

    const context = await resolveConversationContext(supabase, conversationId);
    if (!context) {
      return null;
    }

    const remoteJid = toRemoteJid(senderPhone) ?? context.remoteJid;
    if (!remoteJid) {
      console.error("❌ Could not resolve remoteJid for media download:", { conversationId, externalId });
      return null;
    }

    const endpoint = `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${context.instanceName}`;

    const retryDelays = [0, 800, 1800];

    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
      if (retryDelays[attempt] > 0) {
        await sleep(retryDelays[attempt]);
      }

      console.log("📥 Downloading media from Evolution:", {
        attempt: attempt + 1,
        instance: context.instanceName,
        externalId,
        remoteJid,
        direction,
      });

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
          body: JSON.stringify({
            message: {
              key: { id: externalId, remoteJid, fromMe: direction === "outbound" },
            },
            convertToMp4: messageType === "video",
          }),
        });

        if (!response.ok) {
          console.error("❌ Evolution getBase64 failed:", response.status, await response.text().catch(() => ""));
          continue;
        }

        const result = await response.json().catch(() => null);
        if (!result) {
          console.error("❌ Evolution response was not valid JSON");
          continue;
        }

        let base64Data = result?.base64 && result.base64.length > 0 ? result.base64 : null;

        if (!base64Data && result?.buffer) {
          if (typeof result.buffer === "string" && result.buffer.length > 0) {
            base64Data = result.buffer;
          } else if (result.buffer?.data && Array.isArray(result.buffer.data)) {
            const uint8 = new Uint8Array(result.buffer.data);
            let binary = "";
            for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
            base64Data = btoa(binary);
          } else if (Array.isArray(result.buffer)) {
            const uint8 = new Uint8Array(result.buffer);
            let binary = "";
            for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
            base64Data = btoa(binary);
          }
        }

        if (!base64Data) {
          console.error("❌ No base64 data in Evolution response, keys:", Object.keys(result || {}));
          continue;
        }

        const mimeType = result?.mimetype || result?.mimeType || guessMimeFromType(messageType);
        const storedUrl = await processMediaBase64(
          supabase,
          base64Data,
          mimeType,
          conversationId,
          context.organizationId,
        );

        if (storedUrl) {
          return storedUrl;
        }
      } catch (attemptErr) {
        console.error(`❌ downloadAndStoreMedia attempt ${attempt + 1} failed:`, attemptErr);
      }
    }

    console.error("❌ Failed to retrieve media from Evolution after retries:", {
      conversationId,
      externalId,
      messageType,
    });
    return null;
  } catch (err) {
    console.error("❌ downloadAndStoreMedia error:", err);
    return null;
  }
}

function guessMimeFromType(type: string): string {
  const map: Record<string, string> = {
    image: "image/jpeg", audio: "audio/ogg", video: "video/mp4",
    document: "application/pdf", sticker: "image/webp",
  };
  return map[type] || "application/octet-stream";
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
        // If inserting a media message without media_url, try to download from Evolution API
        if (table === "whatsapp_messages" && isPlainObject(data)) {
          const msgData = data as Record<string, unknown>;
          const mediaTypes = ["image", "audio", "video", "document", "sticker"];
          const isMediaMsg = mediaTypes.includes(String(msgData.message_type || ""));
          const hasMediaUrl = typeof msgData.media_url === "string" && msgData.media_url.trim().length > 0;
          const mediaMessageId = getMediaMessageId(msgData);
          const inlineMediaBase64 = firstNonEmptyString(
            msgData.media_base64,
            msgData.base64,
            msgData.file_base64,
            msgData.fileBase64,
          );
          const inlineMimeType = firstNonEmptyString(
            msgData.media_mime_type,
            msgData.media_content_type,
            msgData.mime_type,
            msgData.mimeType,
            msgData.content_type,
            msgData.contentType,
          ) || "application/octet-stream";
          
          console.log("vps-bridge INSERT whatsapp_messages:", JSON.stringify({
            message_type: msgData.message_type,
            hasMediaUrl,
            mediaMessageId,
            conversation_id: msgData.conversation_id,
            hasMediaBase64: !!inlineMediaBase64,
            dataKeys: Object.keys(msgData),
          }));

          // If VPS sent media_base64 directly, upload it
          if (isMediaMsg && !hasMediaUrl && inlineMediaBase64 && msgData.conversation_id) {
            console.log("📹 Processing inline media_base64 for message insert");
            const mediaUrl = await processMediaBase64(
              supabase,
              inlineMediaBase64,
              inlineMimeType,
              msgData.conversation_id as string,
              firstNonEmptyString(msgData.organization_id),
            );
            if (mediaUrl) {
              msgData.media_url = mediaUrl;
              console.log("✅ media_url set from base64:", mediaUrl.substring(0, 80));
            }
          }

          // If still no media_url, try downloading from Evolution API
          if (isMediaMsg && !msgData.media_url && mediaMessageId && msgData.conversation_id) {
            console.log("📹 Attempting to download media from Evolution API for message:", mediaMessageId);
            try {
              const mediaUrl = await downloadAndStoreMedia(
                supabase,
                msgData.conversation_id as string,
                mediaMessageId,
                msgData.message_type as string,
                firstNonEmptyString(
                  msgData.sender_phone,
                  msgData.senderPhone,
                  msgData.customer_phone_e164,
                  msgData.phone_number,
                  msgData.chat_id,
                ) || undefined,
                firstNonEmptyString(msgData.direction) || undefined,
              );
              if (mediaUrl) {
                msgData.media_url = mediaUrl;
                console.log("✅ media_url set from Evolution download:", mediaUrl.substring(0, 80));
              }
            } catch (mediaErr) {
              console.error("❌ Failed to download media from Evolution:", mediaErr);
            }
          }

          for (const key of [
            "media_base64",
            "media_mime_type",
            "media_content_type",
            "base64",
            "file_base64",
            "fileBase64",
            "mime_type",
            "mimeType",
            "content_type",
            "contentType",
            "external_id",
            "externalId",
            "organization_id",
            "sender_phone",
            "senderPhone",
            "chat_id",
          ]) {
            delete msgData[key];
          }
        }

        let query = db.from(table).insert(data);
        const insertSelect = typeof body.select === "string" ? body.select : typeof normalizedOptions?.select === "string" ? normalizedOptions.select : null;
        if (insertSelect) query = query.select(insertSelect);
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
        const updateSelect = typeof body.select === "string" ? body.select : typeof normalizedOptions?.select === "string" ? normalizedOptions.select : null;
        if (updateSelect) query = query.select(updateSelect);
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
        // Clean base64: remove data URI prefix, whitespace, newlines
        let rawBase64 = typeof data === "string" ? data : "";
        if (rawBase64.includes(",") && rawBase64.startsWith("data:")) {
          rawBase64 = rawBase64.split(",")[1];
        }
        rawBase64 = rawBase64.replace(/\s/g, "").replace(/[^A-Za-z0-9+/=]/g, "");
        // Fix padding if needed
        while (rawBase64.length % 4 !== 0) rawBase64 += "=";
        
        const fileBody = Uint8Array.from(atob(rawBase64), (c) => c.charCodeAt(0));
        const uploadBucket = bucket || table || "whatsapp-media";
        const uploadPath = storagePath || body.path || body.filePath || body.fileName;
        
        console.log("vps-bridge storage_upload:", JSON.stringify({
          bucket: uploadBucket,
          path: uploadPath,
          base64Length: rawBase64.length,
          contentType: normalizedOptions?.contentType || body.contentType,
        }));
        
        const { data: uploadData, error } = await supabase.storage
          .from(uploadBucket)
          .upload(uploadPath, fileBody, {
            contentType: normalizedOptions?.contentType || body.contentType || "application/octet-stream",
            upsert: normalizedOptions?.upsert ?? true,
          });
        if (error) throw error;
        
        // Also return the public URL so the VPS can use it immediately
        const { data: urlData } = supabase.storage
          .from(uploadBucket)
          .getPublicUrl(uploadPath);
        
        return json({ data: uploadData, publicUrl: urlData?.publicUrl || null });
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
