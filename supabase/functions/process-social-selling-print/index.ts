import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

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
   - If you see a USERNAME (no spaces, only a-z 0-9 . _) → return it as type "handle"
   - If you see a DISPLAY NAME (has spaces, emojis, uppercase words, titles) → return it as type "display_name"
4. Double-check: your output array length MUST equal the number of visible conversation rows

CRITICAL RULES:
- NEVER skip a row. Every visible conversation = one entry in your output
- NEVER invent or guess information. Only return what is literally visible
- Include partially visible rows at top/bottom edges — extract whatever is readable
- A handle has NO spaces. If it has spaces, it's a display_name
- Remove any emoji or special decoration from handles but keep display names as-is (without emojis)
- Do NOT confuse the message preview text (like "Enviado há 5 min") with the name/handle

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
      // Legacy format: plain string array — treat as handle
      const raw = item.toLowerCase().trim().replace(/^@/, "");
      if (isValidHandle(raw)) {
        results.push({ type: "handle", value: raw });
      } else if (raw.length > 0) {
        // Might be a display name returned as string
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
          // AI said handle but it has spaces/invalid chars — treat as display_name
          console.warn(`[NORMALIZE] AI marked as handle but invalid: "${raw}" — treating as display_name`);
          results.push({ type: "display_name", value: value });
        }
      } else if (type === "display_name") {
        // Clean emojis and excess whitespace from display names
        const cleaned = value.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}♥️❤🖤💜💛💚💙🤍🩷🩵🩶⚡✨🌟⭐🔥💫🏋️‍♀️🏋️‍♂️💪🧠🫀🫁🦷🦴🩺💊🏥🏨🔬🧬🧪💉🩹🩻🩸🩺]/gu, "").trim();
        if (cleaned.length > 0) {
          results.push({ type: "display_name", value: cleaned });
        }
      } else {
        // Unknown type — try to figure it out
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

async function extractFromScreenshot(
  filePath: string,
  supabase: ReturnType<typeof createClient>,
  GROQ_API_KEY: string
): Promise<ExtractionResult> {
  console.log(`[EXTRACT] Processing file: ${filePath}`);
  
  try {
    const { data: signedData, error: signedError } = await supabase.storage
      .from("social-selling-prints")
      .createSignedUrl(filePath, 3600);

    if (signedError || !signedData?.signedUrl) {
      console.error(`[EXTRACT] SignedUrl error for ${filePath}:`, signedError?.message || "No URL returned");
      return { entries: [] };
    }

    const signedUrl = signedData.signedUrl;

    const imgResponse = await fetch(signedUrl);
    if (!imgResponse.ok) {
      console.error(`[EXTRACT] Image download FAILED for ${filePath}: ${imgResponse.status}`);
      return { entries: [] };
    }

    const imgBuffer = await imgResponse.arrayBuffer();
    const imgBytes = new Uint8Array(imgBuffer);
    const imgSize = imgBytes.length;
    console.log(`[EXTRACT] Image downloaded: ${imgSize} bytes`);

    if (imgSize < 500) {
      console.error(`[EXTRACT] Image too small (${imgSize} bytes). Skipping.`);
      return { entries: [] };
    }

    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < imgBytes.length; i += chunkSize) {
      const chunk = imgBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    let mimeType = imgResponse.headers.get("content-type") || "";
    if (!mimeType || mimeType === "application/octet-stream") {
      const ext = filePath.toLowerCase().split('.').pop();
      if (ext === "png") mimeType = "image/png";
      else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
      else if (ext === "webp") mimeType = "image/webp";
      else mimeType = "image/jpeg";
    }

    console.log(`[EXTRACT] Calling Groq Vision API for ${filePath} (mime: ${mimeType}, base64 length: ${base64.length})...`);

    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
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
                text: `Analyze this Instagram DM list screenshot. Extract EVERY conversation row visible — from the very top to the very bottom, including partially visible ones.

For each row, return:
- type "handle" if you see a username (no spaces, only letters/numbers/dots/underscores)
- type "display_name" if you see a display name (has spaces, titles, special chars)

Return a JSON array of objects. The array length MUST match the total number of conversation rows visible. Do NOT skip any row. Do NOT invent information.`
              }
            ],
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[EXTRACT] AI API error ${aiResponse.status} for ${filePath}: ${errText.substring(0, 500)}`);
      if (aiResponse.status === 402) {
        return { entries: [], error: "Créditos Groq esgotados.", errorCode: 402 };
      }
      if (aiResponse.status === 429) {
        return { entries: [], error: "Limite de requisições Groq excedido. Tente novamente em alguns minutos.", errorCode: 429 };
      }
      return { entries: [], error: `Erro na API Groq: ${aiResponse.status}` };
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";
    console.log(`[EXTRACT] AI response for ${filePath}: ${content.substring(0, 800)}`);

    const entries = parseEntries(content);
    console.log(`[EXTRACT] File ${filePath} => ${entries.length} entries (${entries.filter(e => e.type === "handle").length} handles, ${entries.filter(e => e.type === "display_name").length} display names)`);
    return { entries };
  } catch (err) {
    console.error(`[EXTRACT] Exception for ${filePath}:`, err);
    return { entries: [] };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
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

    const { import_id } = await req.json();
    if (!import_id) throw new Error("import_id required");

    console.log(`[MAIN] Processing import: ${import_id}`);

    const { data: importRecord, error: importErr } = await supabase
      .from("social_selling_imports")
      .select("*, social_sellers(name), social_selling_profiles(instagram_username)")
      .eq("id", import_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (importErr || !importRecord) {
      console.error("[MAIN] Import not found:", importErr?.message);
      throw new Error("Import not found");
    }

    await supabase
      .from("social_selling_imports")
      .update({ status: "processing" })
      .eq("id", import_id);

    const screenshotUrls: string[] = importRecord.screenshot_urls || [];
    console.log(`[MAIN] Found ${screenshotUrls.length} screenshots`);

    // Process screenshots sequentially
    const allEntries: ExtractedEntry[] = [];

    for (let i = 0; i < screenshotUrls.length; i++) {
      const url = screenshotUrls[i];
      const filePath = url.includes("social-selling-prints/")
        ? url.replace(/^.*social-selling-prints\//, "")
        : url;
      
      console.log(`[MAIN] Processing screenshot ${i + 1}/${screenshotUrls.length}: ${filePath}`);
      
      const result = await extractFromScreenshot(filePath, supabase, GROQ_API_KEY);
      
      if (result.error && (result.errorCode === 402 || result.errorCode === 429)) {
        await supabase
          .from("social_selling_imports")
          .update({ status: "error" })
          .eq("id", import_id);

        return new Response(
          JSON.stringify({ error: result.error }),
          { status: result.errorCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      allEntries.push(...result.entries);
      
      console.log(`[MAIN] Screenshot ${i + 1} extracted ${result.entries.length} entries. Running total: ${allEntries.length}`);
    }

    // Deduplicate: for handles, dedupe by lowercase value. For display names, dedupe by trimmed value
    const seenHandles = new Set<string>();
    const seenDisplayNames = new Set<string>();
    const uniqueEntries: ExtractedEntry[] = [];

    for (const entry of allEntries) {
      if (entry.type === "handle") {
        if (!seenHandles.has(entry.value)) {
          seenHandles.add(entry.value);
          uniqueEntries.push(entry);
        }
      } else {
        const key = entry.value.toLowerCase().trim();
        if (!seenDisplayNames.has(key)) {
          seenDisplayNames.add(key);
          uniqueEntries.push(entry);
        }
      }
    }

    console.log(`[MAIN] Total unique entries: ${uniqueEntries.length} (${uniqueEntries.filter(e => e.type === "handle").length} handles, ${uniqueEntries.filter(e => e.type === "display_name").length} display names)`);

    // Find target funnel stage
    const { data: allStages } = await supabase
      .from("organization_funnel_stages")
      .select("id, name, enum_value, position")
      .eq("organization_id", profile.organization_id)
      .order("position", { ascending: true });

    const targetStage = (allStages || []).find((s: any) => 
      s.name.toLowerCase().includes("prospecção ativa instagram") ||
      s.name.toLowerCase().includes("prospeccao ativa instagram")
    ) || (allStages || [])[0];

    const stageEnum = targetStage?.enum_value || "no_contact";
    const targetFunnelStageId = targetStage?.id || null;
    console.log(`[MAIN] Target stage: "${targetStage?.name}" (id: ${targetFunnelStageId}, enum: ${stageEnum})`);
    
    let leadsCreated = 0;
    let leadsSkipped = 0;
    const allUsernames: string[] = [];

    for (const entry of uniqueEntries) {
      if (entry.type === "handle") {
        const username = entry.value;
        allUsernames.push(username);

        // Check if activity already exists for this handle
        const { data: existingActivity } = await supabase
          .from("social_selling_activities")
          .select("id")
          .eq("organization_id", profile.organization_id)
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

        // Check if lead already exists by instagram handle
        const { data: existingLead } = await supabase
          .from("leads")
          .select("id")
          .eq("organization_id", profile.organization_id)
          .or(`instagram.ilike.${username},instagram.ilike.@${username}`)
          .limit(1)
          .maybeSingle();

        let leadId: string;

        if (existingLead) {
          leadId = existingLead.id;
        } else {
          const { data: newLead, error: leadErr } = await supabase
            .from("leads")
            .insert({
              organization_id: profile.organization_id,
              name: `@${username}`,
              instagram: username,
              stage: stageEnum,
              funnel_stage_id: targetFunnelStageId,
              source: "social_selling",
              assigned_to: user.id,
            })
            .select("id")
            .single();

          if (leadErr) {
            console.error("[MAIN] Error creating lead:", leadErr);
            continue;
          }
          leadId = newLead.id;
          leadsCreated++;
        }

        await supabase
          .from("social_selling_activities")
          .insert({
            organization_id: profile.organization_id,
            lead_id: leadId,
            seller_id: importRecord.seller_id,
            profile_id: importRecord.profile_id,
            import_id: import_id,
            activity_type: "message_sent",
            instagram_username: username,
          });

      } else {
        // Display name — no handle available
        const displayName = entry.value;
        allUsernames.push(displayName); // Track for reporting

        // Check if we already have an activity for this display name (by name match)
        const { data: existingLeadByName } = await supabase
          .from("leads")
          .select("id")
          .eq("organization_id", profile.organization_id)
          .eq("source", "social_selling")
          .ilike("name", displayName)
          .limit(1)
          .maybeSingle();

        // Also check if activity already exists
        const { data: existingActivity } = await supabase
          .from("social_selling_activities")
          .select("id")
          .eq("organization_id", profile.organization_id)
          .eq("seller_id", importRecord.seller_id)
          .eq("profile_id", importRecord.profile_id)
          .eq("instagram_username", displayName.toLowerCase().replace(/\s+/g, ''))
          .eq("activity_type", "message_sent")
          .limit(1)
          .maybeSingle();

        if (existingActivity) {
          leadsSkipped++;
          continue;
        }

        let leadId: string;

        if (existingLeadByName) {
          leadId = existingLeadByName.id;
        } else {
          const { data: newLead, error: leadErr } = await supabase
            .from("leads")
            .insert({
              organization_id: profile.organization_id,
              name: displayName,
              instagram: null, // No handle available — don't invent one
              stage: stageEnum,
              funnel_stage_id: targetFunnelStageId,
              source: "social_selling",
              assigned_to: user.id,
            })
            .select("id")
            .single();

          if (leadErr) {
            console.error("[MAIN] Error creating lead (display_name):", leadErr);
            continue;
          }
          leadId = newLead.id;
          leadsCreated++;
        }

        await supabase
          .from("social_selling_activities")
          .insert({
            organization_id: profile.organization_id,
            lead_id: leadId,
            seller_id: importRecord.seller_id,
            profile_id: importRecord.profile_id,
            import_id: import_id,
            activity_type: "message_sent",
            instagram_username: displayName.toLowerCase().replace(/\s+/g, ''),
          });
      }
    }

    await supabase
      .from("social_selling_imports")
      .update({
        status: "completed",
        extracted_usernames: allUsernames,
        leads_created_count: leadsCreated,
        processed_at: new Date().toISOString(),
      })
      .eq("id", import_id);

    console.log(`[MAIN] Done: ${leadsCreated} created, ${leadsSkipped} skipped, ${uniqueEntries.length} total entries`);

    return new Response(
      JSON.stringify({
        success: true,
        usernames: allUsernames,
        leads_created: leadsCreated,
        leads_skipped: leadsSkipped,
        total_extracted: uniqueEntries.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
