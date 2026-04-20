import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// ============================================================================
// AI PROVIDER: Gemini Direct (GEMINI_API_KEY) > Lovable Gateway (LOVABLE_API_KEY)
// ============================================================================
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const _LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const _GEMINI_MAP: Record<string, string> = {
  'google/gemini-3-flash-preview': 'gemini-2.5-flash',
  'google/gemini-3.1-flash-preview': 'gemini-2.5-flash',
  'google/gemini-2.5-flash': 'gemini-2.5-flash',
  'google/gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
  'google/gemini-2.5-pro': 'gemini-2.5-pro',
  'google/gemini-3-pro-image-preview': 'gemini-2.5-flash',
  'google/gemini-3.1-pro-preview': 'gemini-2.5-pro',
  'openai/gpt-5': 'gemini-2.5-pro',
  'openai/gpt-5-mini': 'gemini-2.5-flash',
  'openai/gpt-5-nano': 'gemini-2.5-flash-lite',
};

function _aiUrl() {
  return GEMINI_API_KEY
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    : 'https://ai.gateway.lovable.dev/v1/chat/completions';
}
function _aiHeaders() {
  const key = GEMINI_API_KEY || _LOVABLE_KEY;
  return { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
}
function _aiModel(m: string) {
  return GEMINI_API_KEY ? (_GEMINI_MAP[m] || 'gemini-2.5-flash') : m;
}
function _embedUrl() {
  return GEMINI_API_KEY
    ? 'https://generativelanguage.googleapis.com/v1beta/openai/embeddings'
    : 'https://ai.gateway.lovable.dev/v1/embeddings';
}



const SYSTEM_PROMPT = `You are an expert Instagram DM screenshot analyzer. Your job is to extract information about EVERY SINGLE conversation row visible in the screenshot. Missing even one is a CRITICAL failure.

IMPORTANT CONTEXT:
Instagram DM lists show conversations. Each row may display EITHER:
  A) A USERNAME/HANDLE: text without spaces, containing only letters, numbers, dots (.), underscores (_). Examples: "nutrimanumartins", "dr.monteze", "nutri_karolina.tairovitch"
  B) A DISPLAY NAME: text that may contain spaces, emojis, special characters, titles. Examples: "Morgana Weissheimmer", "PAULO GODOI | MÉDICO", "Dra. Lise Wiederkehr", "Karol Queren | Fitness"

Some rows show the handle clearly. Others show the display name instead. You MUST capture BOTH types.

EXTRACTION PROCESS:
1. Scan the ENTIRE screenshot from TOP to BOTTOM
2. Count EVERY conversation row, including partially visible rows at edges
3. For EACH row, determine what text identifies the person:
   - If you see a USERNAME (no spaces, only letters/numbers/dots/underscores) → return it as type "handle"
   - If you see a DISPLAY NAME (has spaces, titles, special chars) → return it as type "display_name"
4. Double-check: your output array length MUST equal the number of visible conversation rows

CRITICAL RULES:
- NEVER skip a row. Every visible conversation = one entry in your output
- NEVER invent or guess information. Only return what is literally visible on screen
- Include partially visible rows at top/bottom edges — extract whatever is readable
- A handle has NO spaces. If it has spaces, it's a display_name
- Remove any emoji from values but keep display names as-is otherwise
- Do NOT confuse the message preview text (like "Enviado há 5 min", "Enviado agora há pouco") with the name/handle
- The second line of each row is ALWAYS a status/time indicator, NOT a name. Ignore it.
- Look carefully at each row: the FIRST line of text is the name/handle

Return ONLY a valid JSON array of objects. Each object has:
- "type": either "handle" or "display_name"  
- "value": the extracted text (lowercase for handles, original case for display names)

Example:
[
  {"type": "handle", "value": "nutrimanumartins"},
  {"type": "display_name", "value": "Morgana Weissheimmer"},
  {"type": "handle", "value": "vanessanogueiiranutri"},
  {"type": "display_name", "value": "PAULO GODOI | MÉDICO"}
]

Return [] only if the image is completely unreadable or contains no DM conversations.`;

// STRICT validator: Instagram handles allow ONLY a-z, 0-9, dots and underscores
const isValidHandle = (u: string) => /^[a-z0-9._]{1,30}$/.test(u);

interface ExtractedEntry {
  type: "handle" | "display_name";
  value: string;
}

function normalizeAndFilter(arr: unknown[]): ExtractedEntry[] {
  const results: ExtractedEntry[] = [];
  for (const item of arr) {
    if (typeof item === "string") {
      const raw = item.toLowerCase().trim().replace(/^@/, "");
      if (isValidHandle(raw)) {
        results.push({ type: "handle", value: raw });
      } else if (raw.length > 0) {
        results.push({ type: "display_name", value: item.trim() });
      }
      continue;
    }
    
    if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      const type = String(obj.type || "").toLowerCase();
      const value = String(obj.value || "").trim();
      
      if (!value || value.length === 0) continue;
      
      if (type === "handle") {
        const raw = value.toLowerCase().replace(/^@/, "");
        if (isValidHandle(raw)) {
          results.push({ type: "handle", value: raw });
        } else {
          console.warn(`[NORMALIZE] AI marked as handle but invalid: "${raw}" — treating as display_name`);
          results.push({ type: "display_name", value: value });
        }
      } else if (type === "display_name") {
        // Clean emojis from display names
        const cleaned = value.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}♥️❤🖤💜💛💚💙🤍🩷🩵🩶⚡✨🌟⭐🔥💫]/gu, "").trim();
        if (cleaned.length > 0) {
          results.push({ type: "display_name", value: cleaned });
        }
      } else {
        const raw = value.toLowerCase().replace(/^@/, "");
        if (isValidHandle(raw)) {
          results.push({ type: "handle", value: raw });
        } else if (value.length > 0) {
          results.push({ type: "display_name", value: value });
        }
      }
    }
  }
  return results;
}

function parseEntries(content: string): ExtractedEntry[] {
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return normalizeAndFilter(parsed);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) return normalizeAndFilter(parsed);
      } catch {
        console.warn("Failed to parse extracted JSON:", match[0].substring(0, 200));
      }
    } else {
      console.warn("No JSON array found in AI response:", cleaned.substring(0, 200));
    }
  }
  return [];
}

interface ExtractionResult {
  entries: ExtractedEntry[];
  error?: string;
  errorCode?: number;
}

async function callAIWithRetry(
  body: Record<string, unknown>,
  maxRetries = 3
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  // Strategy: try Gemini direct (primary + fallback model), then Lovable Gateway, with retries
  const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  const geminiHeaders = { 'Authorization': `Bearer ${GEMINI_API_KEY}`, 'Content-Type': 'application/json' };
  const lovableUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
  const lovableHeaders = { 'Authorization': `Bearer ${_LOVABLE_KEY}`, 'Content-Type': 'application/json' };

  const originalModel = (body.model as string) || 'google/gemini-2.5-flash';

  // Build ordered list of attempts: Gemini primary model, Gemini fallback model, Lovable Gateway
  const attempts: { url: string; headers: Record<string,string>; model: string; label: string }[] = [];
  
  if (GEMINI_API_KEY) {
    const primaryModel = _aiModel(originalModel);
    attempts.push({ url: geminiUrl, headers: geminiHeaders, model: primaryModel, label: 'Gemini Direct' });
    // Add fallback model if different
    const fallbackModel = primaryModel === 'gemini-2.5-flash' ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash';
    attempts.push({ url: geminiUrl, headers: geminiHeaders, model: fallbackModel, label: `Gemini Fallback (${fallbackModel})` });
  }
  if (_LOVABLE_KEY) {
    attempts.push({ url: lovableUrl, headers: lovableHeaders, model: originalModel, label: 'Lovable Gateway' });
  }

  for (const strategy of attempts) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const requestBody = { ...body, model: strategy.model };
        console.log(`[AI] ${strategy.label} attempt ${attempt}/${maxRetries} (model: ${requestBody.model})`);

        const response = await fetch(strategy.url, {
          method: 'POST',
          headers: strategy.headers,
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const data = await response.json();
          return { ok: true, status: 200, data };
        }

        const errText = await response.text();

        // 503 = overloaded, 429 = rate limit — retry then fallback
        if ((response.status === 503 || response.status === 429) && attempt < maxRetries) {
          const wait = Math.min(2000 * attempt, 8000);
          console.warn(`[AI] ${strategy.label} returned ${response.status}, retrying in ${wait}ms...`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }

        // 503/429/402/404 on last attempt or first hit — try next strategy
        if (response.status === 503 || response.status === 429 || response.status === 402 || response.status === 404) {
          console.warn(`[AI] ${strategy.label} returned ${response.status}, trying next strategy...`);
          break;
        }

        // Other errors (400, etc.) — return immediately
        console.error(`[AI] ${strategy.label} error ${response.status}: ${errText.substring(0, 300)}`);
        return { ok: false, status: response.status, error: errText };
      } catch (err) {
        console.error(`[AI] ${strategy.label} exception on attempt ${attempt}:`, err);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
          continue;
        }
        break;
      }
    }
  }

  return { ok: false, status: 503, error: 'All AI providers unavailable after retries' };
}

// Safe base64 encoder that avoids stack overflow with large files
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 4096;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]);
    }
  }
  return btoa(binary);
}

async function extractFromScreenshot(
  filePath: string,
  supabase: ReturnType<typeof createClient>,
  LOVABLE_API_KEY: string
): Promise<ExtractionResult> {
  console.log(`[EXTRACT] ===== START file: ${filePath} =====`);
  
  try {
    // Step 1: Get signed URL
    console.log(`[EXTRACT] Step 1: Creating signed URL...`);
    const { data: signedData, error: signedError } = await supabase.storage
      .from("social-selling-prints")
      .createSignedUrl(filePath, 3600);

    if (signedError || !signedData?.signedUrl) {
      console.error(`[EXTRACT] FAILED Step 1 - SignedUrl error for ${filePath}:`, JSON.stringify(signedError) || "No URL returned");
      return { entries: [], error: `Storage error: ${signedError?.message || 'no URL'}` };
    }

    console.log(`[EXTRACT] Step 1 OK: signed URL obtained`);

    // Step 2: Download image
    console.log(`[EXTRACT] Step 2: Downloading image...`);
    const imgResponse = await fetch(signedData.signedUrl);
    if (!imgResponse.ok) {
      console.error(`[EXTRACT] FAILED Step 2 - Image download error: ${imgResponse.status} ${imgResponse.statusText}`);
      return { entries: [], error: `Download failed: ${imgResponse.status}` };
    }

    const imgBuffer = await imgResponse.arrayBuffer();
    const imgBytes = new Uint8Array(imgBuffer);
    const imgSize = imgBytes.length;
    console.log(`[EXTRACT] Step 2 OK: ${imgSize} bytes downloaded`);

    if (imgSize < 500) {
      console.error(`[EXTRACT] FAILED - Image too small (${imgSize} bytes)`);
      return { entries: [], error: `Image too small: ${imgSize} bytes` };
    }

    // Step 3: Encode to base64 (safe method)
    console.log(`[EXTRACT] Step 3: Encoding to base64...`);
    let base64: string;
    try {
      base64 = uint8ToBase64(imgBytes);
    } catch (encErr) {
      console.error(`[EXTRACT] FAILED Step 3 - Base64 encoding error:`, encErr);
      return { entries: [], error: `Base64 encoding failed` };
    }
    console.log(`[EXTRACT] Step 3 OK: base64 length = ${base64.length}`);

    // If base64 is too large (>10MB), the AI call might fail
    if (base64.length > 15_000_000) {
      console.warn(`[EXTRACT] WARNING: base64 is very large (${(base64.length / 1_000_000).toFixed(1)}MB) — may fail`);
    }

    let mimeType = imgResponse.headers.get("content-type") || "";
    if (!mimeType || mimeType === "application/octet-stream") {
      const ext = filePath.toLowerCase().split('.').pop();
      if (ext === "png") mimeType = "image/png";
      else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
      else if (ext === "webp") mimeType = "image/webp";
      else mimeType = "image/jpeg";
    }

    // Step 4: Call AI
    console.log(`[EXTRACT] Step 4: Calling AI (mime: ${mimeType}, base64: ${(base64.length / 1000).toFixed(0)}KB)...`);

    const aiResult = await callAIWithRetry({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
            {
              type: "text",
              text: `Analyze this Instagram DM list screenshot carefully. Extract EVERY conversation row visible — from the very top to the very bottom, including partially visible ones.

For each row, return:
- type "handle" if you see a username (no spaces, only letters/numbers/dots/underscores)  
- type "display_name" if you see a display name (has spaces, titles, special chars)

IMPORTANT: The second line of each row (like "Enviado há 5 min" or "Enviado agora há pouco") is a timestamp, NOT a name. Ignore it.

Return a JSON array of objects. The array length MUST match the total number of conversation rows visible. Do NOT skip any row. Do NOT invent information — only return what you can literally read.`
            }
          ],
        },
      ],
      max_tokens: 4096,
    });

    if (!aiResult.ok) {
      console.error(`[EXTRACT] FAILED Step 4 - AI error: status ${aiResult.status}, error: ${aiResult.error?.substring(0, 500)}`);
      if (aiResult.status === 402) {
        return { entries: [], error: "Créditos de IA esgotados. Recarregue no painel de Usage.", errorCode: 402 };
      }
      if (aiResult.status === 429) {
        return { entries: [], error: "Limite de requisições excedido. Tente novamente em alguns minutos.", errorCode: 429 };
      }
      return { entries: [], error: `AI error: ${aiResult.status} - ${aiResult.error?.substring(0, 200)}` };
    }

    const content = aiResult.data?.choices?.[0]?.message?.content || "[]";
    console.log(`[EXTRACT] Step 4 OK - AI response (first 1000 chars): ${content.substring(0, 1000)}`);

    // Step 5: Parse entries
    const entries = parseEntries(content);
    console.log(`[EXTRACT] Step 5 OK: ${entries.length} entries (${entries.filter(e => e.type === "handle").length} handles, ${entries.filter(e => e.type === "display_name").length} display names)`);
    console.log(`[EXTRACT] ===== END file: ${filePath} => ${entries.length} entries =====`);
    return { entries };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : '';
    console.error(`[EXTRACT] UNCAUGHT EXCEPTION for ${filePath}: ${errMsg}`);
    console.error(`[EXTRACT] Stack: ${errStack}`);
    return { entries: [], error: `Exception: ${errMsg}` };
  }
}

interface ImportProgress {
  kind: "progress";
  next_index: number;
  processed_screenshots: number;
  total_screenshots: number;
  leads_created: number;
  leads_existing: number;
  leads_skipped: number;
  total_extracted: number;
  extracted_usernames: string[];
  extraction_errors: string[];
  entries: ExtractedEntry[];
}

function entryKey(entry: ExtractedEntry): string {
  return entry.type === "handle"
    ? `h:${entry.value.toLowerCase().replace(/^@/, "")}`
    : `d:${entry.value.toLowerCase().trim()}`;
}

function dedupeEntries(entries: ExtractedEntry[]): ExtractedEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entryKey(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function entriesToNames(entries: ExtractedEntry[]): string[] {
  return entries.map((entry) => entry.type === "handle" ? `@${entry.value}` : entry.value);
}

function createEmptyProgress(totalScreenshots: number): ImportProgress {
  return {
    kind: "progress",
    next_index: 0,
    processed_screenshots: 0,
    total_screenshots: totalScreenshots,
    leads_created: 0,
    leads_existing: 0,
    leads_skipped: 0,
    total_extracted: 0,
    extracted_usernames: [],
    extraction_errors: [],
    entries: [],
  };
}

function parseImportProgress(errorMessage: string | null | undefined, totalScreenshots: number): ImportProgress {
  const fallback = createEmptyProgress(totalScreenshots);
  if (!errorMessage) return fallback;

  try {
    const parsed = JSON.parse(errorMessage);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || parsed.kind !== "progress") {
      return fallback;
    }

    const obj = parsed as Record<string, unknown>;
    const entries = Array.isArray(obj.entries) ? dedupeEntries(normalizeAndFilter(obj.entries)) : [];
    const extractedUsernames = Array.isArray(obj.extracted_usernames)
      ? obj.extracted_usernames.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : entriesToNames(entries);

    return {
      kind: "progress",
      next_index: typeof obj.next_index === "number" ? obj.next_index : 0,
      processed_screenshots: typeof obj.processed_screenshots === "number" ? obj.processed_screenshots : 0,
      total_screenshots: totalScreenshots,
      leads_created: typeof obj.leads_created === "number" ? obj.leads_created : 0,
      leads_existing: typeof obj.leads_existing === "number" ? obj.leads_existing : 0,
      leads_skipped: typeof obj.leads_skipped === "number" ? obj.leads_skipped : 0,
      total_extracted: entries.length,
      extracted_usernames: extractedUsernames,
      extraction_errors: Array.isArray(obj.extraction_errors)
        ? obj.extraction_errors.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [],
      entries,
    };
  } catch {
    return fallback;
  }
}

async function applyEntriesChunk(
  supabase: ReturnType<typeof createClient>,
  importRecord: any,
  orgId: string,
  userId: string | null,
  entries: ExtractedEntry[],
) {
  const uniqueEntries = dedupeEntries(entries);
  if (uniqueEntries.length === 0) {
    return { leadsCreated: 0, leadsExisting: 0, leadsSkipped: 0 };
  }

  const { data: allStages } = await supabase
    .from("organization_funnel_stages")
    .select("id, name, enum_value, position")
    .eq("organization_id", orgId)
    .order("position", { ascending: true });

  const targetStage = (allStages || []).find((s: any) =>
    s.name.toLowerCase().includes("prospecção ativa instagram") ||
    s.name.toLowerCase().includes("prospeccao ativa instagram")
  ) || (allStages || [])[0];

  const stageEnum = targetStage?.enum_value || "no_contact";
  const targetFunnelStageId = targetStage?.id || null;

  let leadsCreated = 0;
  let leadsExisting = 0;
  let leadsSkipped = 0;

  for (const entry of uniqueEntries) {
    if (entry.type === "handle") {
      const username = entry.value;
      const { data: existingActivity } = await supabase
        .from("social_selling_activities")
        .select("id")
        .eq("organization_id", orgId)
        .eq("seller_id", importRecord.seller_id)
        .eq("profile_id", importRecord.profile_id)
        .eq("instagram_username", username)
        .eq("activity_type", "message_sent")
        .limit(1)
        .maybeSingle();

      if (existingActivity) {
        leadsSkipped++;
        continue;
      }

      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("organization_id", orgId)
        .or(`instagram.ilike.${username},instagram.ilike.@${username}`)
        .limit(1)
        .maybeSingle();

      let leadId: string;
      if (existingLead) {
        leadId = existingLead.id;
        leadsExisting++;
      } else {
        const { data: newLead, error: leadErr } = await supabase
          .from("leads")
          .insert({
            organization_id: orgId,
            name: `@${username}`,
            instagram: username,
            stage: stageEnum,
            funnel_stage_id: targetFunnelStageId,
            source: "social_selling",
            assigned_to: userId,
          })
          .select("id")
          .single();

        if (leadErr) {
          console.error("[BG] lead err:", leadErr);
          continue;
        }

        leadId = newLead.id;
        leadsCreated++;
      }

      await supabase.from("social_selling_activities").insert({
        organization_id: orgId,
        lead_id: leadId,
        seller_id: importRecord.seller_id,
        profile_id: importRecord.profile_id,
        import_id: importRecord.id,
        activity_type: "message_sent",
        instagram_username: username,
      });
      continue;
    }

    const displayName = entry.value;
    const normalizedKey = displayName.toLowerCase().replace(/[^a-z0-9]/g, "");

    const { data: existingActivity } = await supabase
      .from("social_selling_activities")
      .select("id")
      .eq("organization_id", orgId)
      .eq("seller_id", importRecord.seller_id)
      .eq("profile_id", importRecord.profile_id)
      .eq("instagram_username", normalizedKey)
      .eq("activity_type", "message_sent")
      .limit(1)
      .maybeSingle();

    if (existingActivity) {
      leadsSkipped++;
      continue;
    }

    const { data: existingLeadByName } = await supabase
      .from("leads")
      .select("id")
      .eq("organization_id", orgId)
      .eq("source", "social_selling")
      .ilike("name", displayName)
      .limit(1)
      .maybeSingle();

    let leadId: string;
    if (existingLeadByName) {
      leadId = existingLeadByName.id;
      leadsExisting++;
    } else {
      const { data: newLead, error: leadErr } = await supabase
        .from("leads")
        .insert({
          organization_id: orgId,
          name: displayName,
          instagram: null,
          stage: stageEnum,
          funnel_stage_id: targetFunnelStageId,
          source: "social_selling",
          assigned_to: userId,
        })
        .select("id")
        .single();

      if (leadErr) {
        console.error("[BG] lead err (display):", leadErr);
        continue;
      }

      leadId = newLead.id;
      leadsCreated++;
    }

    await supabase.from("social_selling_activities").insert({
      organization_id: orgId,
      lead_id: leadId,
      seller_id: importRecord.seller_id,
      profile_id: importRecord.profile_id,
      import_id: importRecord.id,
      activity_type: "message_sent",
      instagram_username: normalizedKey,
    });
  }

  return { leadsCreated, leadsExisting, leadsSkipped };
}

async function queueNextImportChunk(functionUrl: string, internalSecret: string, import_id: string) {
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret,
    },
    body: JSON.stringify({ import_id, background: true }),
  });

  if (!response.ok && response.status !== 202) {
    const errorText = await response.text();
    throw new Error(`Falha ao agendar próximo lote (${response.status}): ${errorText}`);
  }
}

// Background processor — processes one screenshot per invocation to avoid CPU timeouts
async function processImportBackground(
  supabase: ReturnType<typeof createClient>,
  importRecord: any,
  import_id: string,
  orgId: string,
  userId: string | null,
  functionUrl: string,
  internalSecret: string,
  LOVABLE_API_KEY: string,
) {
  const screenshotUrls: string[] = Array.isArray(importRecord.screenshot_urls) ? importRecord.screenshot_urls : [];
  const progress = parseImportProgress(importRecord.error_message, screenshotUrls.length);

  console.log(`[BG] Import ${import_id}: ${progress.next_index}/${screenshotUrls.length} screenshots processed`);

  if (screenshotUrls.length === 0) {
    await supabase.from("social_selling_imports")
      .update({ status: "failed", error_message: "Nenhum print foi enviado para processamento." })
      .eq("id", import_id);
    return;
  }

  if (progress.next_index >= screenshotUrls.length) {
    await supabase.from("social_selling_imports").update({
      status: "completed",
      extracted_usernames: progress.extracted_usernames,
      leads_created_count: progress.leads_created,
      processed_at: new Date().toISOString(),
      error_message: JSON.stringify({
        leads_created: progress.leads_created,
        leads_existing: progress.leads_existing,
        leads_skipped: progress.leads_skipped,
        total_extracted: progress.total_extracted,
      }),
    }).eq("id", import_id);
    return;
  }

  const currentIndex = progress.next_index;
  const url = screenshotUrls[currentIndex];
  const filePath = url.includes("social-selling-prints/")
    ? url.replace(/^.*social-selling-prints\//, "")
    : url;

  console.log(`[BG] Processing screenshot ${currentIndex + 1}/${screenshotUrls.length}: ${filePath}`);
  const result = await extractFromScreenshot(filePath, supabase, LOVABLE_API_KEY);

  if (result.error && (result.errorCode === 402 || result.errorCode === 429)) {
    await supabase.from("social_selling_imports")
      .update({ status: "failed", error_message: result.error })
      .eq("id", import_id);
    return;
  }

  const mergedEntries = dedupeEntries([...progress.entries, ...result.entries]);
  const existingKeys = new Set(progress.entries.map(entryKey));
  const deltaEntries = mergedEntries.filter((entry) => !existingKeys.has(entryKey(entry)));
  const chunkStats = await applyEntriesChunk(supabase, importRecord, orgId, userId, deltaEntries);

  const updatedProgress: ImportProgress = {
    kind: "progress",
    next_index: currentIndex + 1,
    processed_screenshots: currentIndex + 1,
    total_screenshots: screenshotUrls.length,
    leads_created: progress.leads_created + chunkStats.leadsCreated,
    leads_existing: progress.leads_existing + chunkStats.leadsExisting,
    leads_skipped: progress.leads_skipped + chunkStats.leadsSkipped,
    total_extracted: mergedEntries.length,
    extracted_usernames: entriesToNames(mergedEntries),
    extraction_errors: result.error
      ? [...progress.extraction_errors, `Screenshot ${currentIndex + 1}: ${result.error}`]
      : progress.extraction_errors,
    entries: mergedEntries,
  };

  const isComplete = updatedProgress.next_index >= screenshotUrls.length;
  if (isComplete) {
    if (updatedProgress.total_extracted === 0) {
      const errMsg = updatedProgress.extraction_errors.length > 0
        ? `Nenhum lead extraído. Erros: ${updatedProgress.extraction_errors.join('; ')}`
        : 'Nenhum lead extraído dos prints. Verifique se as imagens são screenshots de DMs do Instagram.';

      await supabase.from("social_selling_imports")
        .update({ status: "failed", error_message: errMsg, processed_at: new Date().toISOString() })
        .eq("id", import_id);
      return;
    }

    await supabase.from("social_selling_imports").update({
      status: "completed",
      extracted_usernames: updatedProgress.extracted_usernames,
      leads_created_count: updatedProgress.leads_created,
      processed_at: new Date().toISOString(),
      error_message: JSON.stringify({
        leads_created: updatedProgress.leads_created,
        leads_existing: updatedProgress.leads_existing,
        leads_skipped: updatedProgress.leads_skipped,
        total_extracted: updatedProgress.total_extracted,
        extraction_errors: updatedProgress.extraction_errors,
      }),
    }).eq("id", import_id);

    console.log(`[BG] Done: ${updatedProgress.leads_created} created, ${updatedProgress.leads_existing} existing, ${updatedProgress.leads_skipped} skipped`);
    return;
  }

  await supabase.from("social_selling_imports").update({
    status: "processing",
    extracted_usernames: updatedProgress.extracted_usernames,
    leads_created_count: updatedProgress.leads_created,
    error_message: JSON.stringify(updatedProgress),
  }).eq("id", import_id);

  try {
    await queueNextImportChunk(functionUrl, internalSecret, import_id);
  } catch (err) {
    console.error("[BG] Failed to queue next chunk:", err);
    await supabase.from("social_selling_imports")
      .update({ status: "failed", error_message: err instanceof Error ? err.message : String(err) })
      .eq("id", import_id);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const functionUrl = `${supabaseUrl}/functions/v1/process-social-selling-print`;
    const internalSecret = supabaseKey;

    const { import_id, background } = await req.json();
    if (!import_id) throw new Error("import_id required");

    const internalHeader = req.headers.get("x-internal-secret");
    const isInternalRequest = internalHeader === internalSecret;

    let userId: string | null = null;
    let organizationId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (!isInternalRequest) {
      if (!authHeader) throw new Error("No auth header");

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) throw new Error("Unauthorized");

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();
      if (!profile?.organization_id) throw new Error("No org");

      userId = user.id;
      organizationId = profile.organization_id;
    }

    console.log(`[MAIN] ========== Processing import: ${import_id} ==========`);
    console.log(`[MAIN] Mode: ${isInternalRequest ? 'internal' : 'user'}${organizationId ? `, Org: ${organizationId}` : ''}`);

    const { data: importRecord, error: importErr } = await supabase
      .from("social_selling_imports")
      .select("*, social_sellers(name), social_selling_profiles(instagram_username)")
      .eq("id", import_id)
      .single();

    if (importErr || !importRecord) {
      console.error("[MAIN] Import not found:", JSON.stringify(importErr));
      throw new Error(`Import not found: ${importErr?.message || 'null record'}`);
    }

    if (!organizationId) organizationId = importRecord.organization_id;
    if (!userId) userId = importRecord.created_by;

    if (!isInternalRequest && importRecord.organization_id !== organizationId) {
      throw new Error("Import not found for this organization");
    }

    console.log(`[MAIN] Import record found. seller_id: ${importRecord.seller_id}, profile_id: ${importRecord.profile_id}`);

    await supabase
      .from("social_selling_imports")
      .update({ status: "processing" })
      .eq("id", import_id);

    // @ts-ignore - EdgeRuntime is available in Supabase edge runtime
    EdgeRuntime.waitUntil(
      processImportBackground(
        supabase,
        importRecord,
        import_id,
        organizationId!,
        userId,
        functionUrl,
        internalSecret,
        LOVABLE_API_KEY,
      ).catch(async (err) => {
        console.error("[BG] Fatal error:", err);
        await supabase
          .from("social_selling_imports")
          .update({ status: "failed", error_message: err?.message || String(err) })
          .eq("id", import_id);
      })
    );

    return new Response(
      JSON.stringify({ success: true, status: "processing", import_id, background: background !== false }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[MAIN] Error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
