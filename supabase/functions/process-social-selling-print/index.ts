import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SYSTEM_PROMPT = `You are an expert Instagram DM screenshot analyzer. Extract EVERY Instagram USERNAME (handle) from the screenshot.

CRITICAL DISTINCTION:
- Instagram has TWO text fields per conversation row:
  1. USERNAME (handle): below the profile picture, in smaller/lighter gray text. Contains ONLY letters, numbers, dots (.), underscores (_). Example: "dr.monteze", "nutri.maria123", "joao_silva"
  2. DISPLAY NAME: the bold/larger text at top. May contain spaces and special characters. Example: "Dr. José Eduardo", "EVELYN REGLY". DO NOT return these.

RULES:
- Return ONLY the USERNAME/HANDLE field, NOT the display name
- A valid Instagram username contains only: a-z, 0-9, dots (.), underscores (_)
- NO spaces allowed in a valid username
- NO special characters other than . and _
- Count every visible row and return that many usernames
- Include partially visible rows at the edges

Return ONLY a valid JSON array. Example: ["dr.monteze", "nutri.maria", "joao_silva", "dra_carla99"]
Return [] only if the image is completely unreadable.`;

// STRICT validator: Instagram handles allow ONLY a-z, 0-9, dots and underscores
const isValidHandle = (u: string) => /^[a-z0-9._]{1,30}$/.test(u);

function normalizeAndFilter(arr: unknown[]): string[] {
  const results: string[] = [];
  for (const item of arr) {
    const raw = String(item).toLowerCase().trim().replace(/^@/, "");
    if (isValidHandle(raw)) {
      results.push(raw);
    } else {
      console.warn(`[REJECTED] Invalid handle: "${raw}"`);
    }
  }
  return results;
}

function parseUsernames(content: string): string[] {
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
  usernames: string[];
  error?: string;
  errorCode?: number;
}

async function extractUsernamesFromScreenshot(
  filePath: string,
  supabase: ReturnType<typeof createClient>,
  GROQ_API_KEY: string
): Promise<ExtractionResult> {
  console.log(`[EXTRACT] Processing file: ${filePath}`);
  
  try {
    // Generate a signed URL (valid 1 hour) - pass this directly to the AI
    const { data: signedData, error: signedError } = await supabase.storage
      .from("social-selling-prints")
      .createSignedUrl(filePath, 3600);

    if (signedError || !signedData?.signedUrl) {
      console.error(`[EXTRACT] SignedUrl error for ${filePath}:`, signedError?.message || "No URL returned");
      return { usernames: [] };
    }

    const signedUrl = signedData.signedUrl;
    console.log(`[EXTRACT] Got signed URL for ${filePath}: ${signedUrl.substring(0, 80)}...`);

    // Download the image to get base64 (AI gateway needs base64 for reliable processing)
    const imgResponse = await fetch(signedUrl);
    if (!imgResponse.ok) {
      console.error(`[EXTRACT] Image download FAILED for ${filePath}: ${imgResponse.status} ${imgResponse.statusText}`);
      return { usernames: [] };
    }

    const imgBuffer = await imgResponse.arrayBuffer();
    const imgBytes = new Uint8Array(imgBuffer);
    const imgSize = imgBytes.length;
    console.log(`[EXTRACT] Image downloaded: ${imgSize} bytes`);

    if (imgSize < 500) {
      console.error(`[EXTRACT] Image too small (${imgSize} bytes), likely invalid. Skipping.`);
      return { usernames: [] };
    }

    // Convert to base64 using chunked approach to avoid stack overflow
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < imgBytes.length; i += chunkSize) {
      const chunk = imgBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    // Detect mime type from content-type header or file extension
    let mimeType = imgResponse.headers.get("content-type") || "";
    if (!mimeType || mimeType === "application/octet-stream") {
      const ext = filePath.toLowerCase().split('.').pop();
      if (ext === "png") mimeType = "image/png";
      else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
      else if (ext === "webp") mimeType = "image/webp";
      else mimeType = "image/jpeg"; // fallback
    }

    console.log(`[EXTRACT] Calling Groq Vision API for ${filePath} (mime: ${mimeType}, base64 length: ${base64.length})...`);

    // Call Groq Vision API with llama-4-scout (fast + cheap vision model)
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
                text: "Extract the Instagram username/handle (NOT the display name) from every conversation row in this DM list screenshot. Return ALL usernames as a JSON array."
              }
            ],
          },
        ],
        max_tokens: 2048,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[EXTRACT] AI API error ${aiResponse.status} for ${filePath}: ${errText.substring(0, 500)}`);
      if (aiResponse.status === 402) {
        return { usernames: [], error: "Créditos Groq esgotados.", errorCode: 402 };
      }
      if (aiResponse.status === 429) {
        return { usernames: [], error: "Limite de requisições Groq excedido. Tente novamente em alguns minutos.", errorCode: 429 };
      }
      return { usernames: [], error: `Erro na API Groq: ${aiResponse.status}` };
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";
    console.log(`[EXTRACT] AI response for ${filePath}: ${content.substring(0, 500)}`);

    const valid = parseUsernames(content);
    console.log(`[EXTRACT] File ${filePath} => ${valid.length} valid usernames: ${valid.join(", ")}`);
    return { usernames: valid };
  } catch (err) {
    console.error(`[EXTRACT] Exception for ${filePath}:`, err);
    return { usernames: [] };
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

    // Process screenshots sequentially to avoid timeout and memory issues
    const allUsernames: string[] = [];

    for (let i = 0; i < screenshotUrls.length; i++) {
      const url = screenshotUrls[i];
      // Clean the file path - remove any full URL prefix
      const filePath = url.includes("social-selling-prints/")
        ? url.replace(/^.*social-selling-prints\//, "")
        : url;
      
      console.log(`[MAIN] Processing screenshot ${i + 1}/${screenshotUrls.length}: ${filePath}`);
      
      const result = await extractUsernamesFromScreenshot(filePath, supabase, GROQ_API_KEY);
      
      // If we hit a payment/rate limit error, stop immediately and return error
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

      allUsernames.push(...result.usernames);
      
      console.log(`[MAIN] Screenshot ${i + 1} extracted ${result.usernames.length} usernames. Running total: ${allUsernames.length}`);
    }

    const uniqueUsernames = [...new Set(allUsernames.filter(u => u.length > 0))];
    console.log(`[MAIN] Total unique usernames: ${uniqueUsernames.length}`);

    // Get first funnel stage
    const { data: firstStage } = await supabase
      .from("organization_funnel_stages")
      .select("id, enum_value")
      .eq("organization_id", profile.organization_id)
      .order("position", { ascending: true })
      .limit(1)
      .single();

    const stageEnum = firstStage?.enum_value || "no_contact";
    let leadsCreated = 0;
    let leadsSkipped = 0;

    for (const username of uniqueUsernames) {
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
    }

    await supabase
      .from("social_selling_imports")
      .update({
        status: "completed",
        extracted_usernames: uniqueUsernames,
        leads_created_count: leadsCreated,
        processed_at: new Date().toISOString(),
      })
      .eq("id", import_id);

    console.log(`[MAIN] Done: ${leadsCreated} created, ${leadsSkipped} skipped, ${uniqueUsernames.length} total`);

    return new Response(
      JSON.stringify({
        success: true,
        usernames: uniqueUsernames,
        leads_created: leadsCreated,
        leads_skipped: leadsSkipped,
        total_extracted: uniqueUsernames.length,
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
