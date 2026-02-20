import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    const { data: importRecord, error: importErr } = await supabase
      .from("social_selling_imports")
      .select("*, social_sellers(name), social_selling_profiles(instagram_username)")
      .eq("id", import_id)
      .eq("organization_id", profile.organization_id)
      .single();

    if (importErr || !importRecord) throw new Error("Import not found");

    await supabase
      .from("social_selling_imports")
      .update({ status: "processing" })
      .eq("id", import_id);

    const screenshotUrls = importRecord.screenshot_urls || [];
    const allUsernames: string[] = [];

    // Process each screenshot with Gemini Vision
    for (const url of screenshotUrls) {
      try {
        const filePath = url.replace(/^.*social-selling-prints\//, "");
        const { data: signedData } = await supabase.storage
          .from("social-selling-prints")
          .createSignedUrl(filePath, 3600);

        if (!signedData?.signedUrl) continue;

        const imgResponse = await fetch(signedData.signedUrl);
        const imgBuffer = await imgResponse.arrayBuffer();
        const base64 = uint8ArrayToBase64(new Uint8Array(imgBuffer));
        const mimeType = imgResponse.headers.get("content-type") || "image/png";

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are an expert Instagram DM screenshot analyzer. Your task is to extract EVERY SINGLE Instagram username visible in the screenshot.

The screenshots show a LIST VIEW of Instagram DM conversations (inbox/direct messages). Each row in the list represents one conversation with one person.

HOW TO FIND USERNAMES:
- Each conversation row has the Instagram username/handle at the TOP of the row (usually in bold or slightly larger text)
- Below the username there is usually a preview of the last message and a timestamp
- Scroll through EVERY ROW in the image - do not miss any
- Profile pictures (circular photos) appear on the left side of each row
- The username is the text next to or below the profile picture

IMPORTANT RULES:
- Extract EVERY username you can see, even partially visible ones at the edges
- Do NOT skip rows even if you're uncertain - include them all
- Usernames may contain letters, numbers, dots, underscores
- Do NOT include the @ symbol in your response
- If there are 10 rows visible, you should return 10 usernames
- Count the rows carefully before responding

Return ONLY a JSON array of strings. Example: ["username1", "dr.example", "john_doe", "nutri.maria", "dra_carla"]
Return [] only if the image is completely unreadable or has no DM conversations.`
              },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: { url: `data:${mimeType};base64,${base64}` },
                  },
                  {
                    type: "text",
                    text: "Count every conversation row visible in this Instagram DM list screenshot and extract the username from each row. Return ALL usernames as a JSON array. Do not miss any row."
                  }
                ],
              },
            ],
          }),
        });

        if (!aiResponse.ok) {
          console.error("AI error:", await aiResponse.text());
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "[]";
        const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
        try {
          const usernames = JSON.parse(cleaned);
          if (Array.isArray(usernames)) {
            allUsernames.push(...usernames.map((u: string) => u.toLowerCase().trim()));
          }
        } catch {
          console.warn("Failed to parse AI response:", content);
        }
      } catch (err) {
        console.error("Error processing screenshot:", err);
      }
    }

    const uniqueUsernames = [...new Set(allUsernames.filter(u => u.length > 0))];

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
      // Check if this username was already imported by ANY previous import
      // for the same seller + profile combo (deduplication across imports)
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

      // Check if lead exists - normalize: search with and without @, case-insensitive
      // Use ilike for case-insensitive match, check both "username" and "@username"
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
        // Lead already exists, don't count as new but still create activity
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
          console.error("Error creating lead:", leadErr);
          continue;
        }
        leadId = newLead.id;
        leadsCreated++;
      }

      // Create activity record (only reaches here if no duplicate activity)
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

    // Update import record
    await supabase
      .from("social_selling_imports")
      .update({
        status: "completed",
        extracted_usernames: uniqueUsernames,
        leads_created_count: leadsCreated,
        processed_at: new Date().toISOString(),
      })
      .eq("id", import_id);

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
    console.error("Error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
