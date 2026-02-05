 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 interface ProcessRequest {
   campaignId: string;
   action: "start" | "pause" | "resume" | "process_batch";
 }
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
     const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
     
     if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
       throw new Error("Twilio credentials not configured");
     }
 
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseKey);
 
     const body: ProcessRequest = await req.json();
     const { campaignId, action } = body;
 
     if (!campaignId || !action) {
       throw new Error("Missing required fields: campaignId, action");
     }
 
     // Get campaign
     const { data: campaign, error: campaignError } = await supabase
       .from("voice_ai_outbound_campaigns")
       .select("*, agent:voice_ai_agents(*)")
       .eq("id", campaignId)
       .single();
 
     if (campaignError || !campaign) {
       throw new Error("Campaign not found");
     }
 
     // Check minutes balance
     const { data: balance } = await supabase
       .from("voice_minutes_balance")
       .select("minutes_remaining")
       .eq("organization_id", campaign.organization_id)
       .single();
 
     if (!balance || balance.minutes_remaining < 1) {
       throw new Error("Insufficient voice minutes balance");
     }
 
     // Handle actions
     switch (action) {
       case "start":
         await supabase
           .from("voice_ai_outbound_campaigns")
           .update({ status: "running", started_at: new Date().toISOString() })
           .eq("id", campaignId);
         break;
 
       case "pause":
         await supabase
           .from("voice_ai_outbound_campaigns")
           .update({ status: "paused" })
           .eq("id", campaignId);
         break;
 
       case "resume":
         await supabase
           .from("voice_ai_outbound_campaigns")
           .update({ status: "running" })
           .eq("id", campaignId);
         break;
 
       case "process_batch":
         // Get pending contacts to call
         const batchSize = campaign.calls_per_minute || 5;
         
         const { data: contacts, error: contactsError } = await supabase
           .from("voice_ai_campaign_contacts")
           .select("*")
           .eq("campaign_id", campaignId)
           .eq("status", "pending")
           .lt("attempts", campaign.max_retries || 3)
           .order("created_at", { ascending: true })
           .limit(batchSize);
 
         if (contactsError) {
           throw new Error("Failed to fetch contacts");
         }
 
         if (!contacts || contacts.length === 0) {
           // No more contacts, mark campaign as completed
           await supabase
             .from("voice_ai_outbound_campaigns")
             .update({ 
               status: "completed", 
               completed_at: new Date().toISOString() 
             })
             .eq("id", campaignId);
 
           return new Response(
             JSON.stringify({ success: true, message: "Campaign completed", processed: 0 }),
             { headers: { ...corsHeaders, "Content-Type": "application/json" } }
           );
         }
 
         // Get Twilio phone number for org
         const { data: twilioNumber } = await supabase
           .from("voice_ai_phone_numbers")
           .select("phone_number, twilio_sid")
           .eq("organization_id", campaign.organization_id)
           .eq("is_active", true)
           .single();
 
         if (!twilioNumber) {
           throw new Error("No active Twilio phone number configured for this organization");
         }
 
         const mediaStreamUrl = `${supabaseUrl}/functions/v1/twilio-media-stream?agent_id=${campaign.agent?.elevenlabs_agent_id}`;
         const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status`;
 
         const callResults = [];
 
         for (const contact of contacts) {
           try {
             // Mark contact as calling
             await supabase
               .from("voice_ai_campaign_contacts")
               .update({ 
                 status: "calling", 
                 attempts: contact.attempts + 1,
                 last_attempt_at: new Date().toISOString()
               })
               .eq("id", contact.id);
 
             // Initiate Twilio call
             const twimlUrl = `${supabaseUrl}/functions/v1/twilio-voice-webhook?agent_id=${campaign.agent?.elevenlabs_agent_id}&campaign_id=${campaignId}&contact_id=${contact.id}`;
 
             const formData = new URLSearchParams();
             formData.append("To", `+${contact.phone}`);
             formData.append("From", twilioNumber.phone_number);
             formData.append("Url", twimlUrl);
             formData.append("StatusCallback", statusCallbackUrl);
             formData.append("StatusCallbackEvent", "initiated ringing answered completed");
             formData.append("StatusCallbackMethod", "POST");
             formData.append("Record", "true");
             formData.append("MachineDetection", "Enable");
             formData.append("MachineDetectionTimeout", "30");
 
             const twilioResponse = await fetch(
               `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
               {
                 method: "POST",
                 headers: {
                   "Authorization": `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
                   "Content-Type": "application/x-www-form-urlencoded",
                 },
                 body: formData.toString(),
               }
             );
 
             const callData = await twilioResponse.json();
 
             if (twilioResponse.ok) {
               // Create call log
               await supabase
                 .from("voice_ai_call_logs")
                 .insert({
                   organization_id: campaign.organization_id,
                   agent_id: campaign.agent_id,
                   direction: "outbound",
                   status: "initiated",
                   from_number: twilioNumber.phone_number,
                   to_number: contact.phone,
                   lead_name: contact.name,
                   twilio_call_sid: callData.sid,
                   started_at: new Date().toISOString(),
                 });
 
               // Update campaign stats
               await supabase
                 .from("voice_ai_outbound_campaigns")
                 .update({ calls_attempted: campaign.calls_attempted + 1 })
                 .eq("id", campaignId);
 
               callResults.push({ 
                 contactId: contact.id, 
                 success: true, 
                 callSid: callData.sid 
               });
             } else {
               console.error("Twilio call failed:", callData);
               
               await supabase
                 .from("voice_ai_campaign_contacts")
                 .update({ status: "failed", error_message: callData.message })
                 .eq("id", contact.id);
 
               callResults.push({ 
                 contactId: contact.id, 
                 success: false, 
                 error: callData.message 
               });
             }
           } catch (err) {
             console.error("Error calling contact:", contact.id, err);
             
             await supabase
               .from("voice_ai_campaign_contacts")
               .update({ 
                 status: "pending", // Allow retry
                 error_message: err instanceof Error ? err.message : "Unknown error"
               })
               .eq("id", contact.id);
 
             callResults.push({ 
               contactId: contact.id, 
               success: false, 
               error: err instanceof Error ? err.message : "Unknown error" 
             });
           }
         }
 
         return new Response(
           JSON.stringify({ 
             success: true, 
             processed: callResults.length,
             results: callResults 
           }),
           { headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
     }
 
     return new Response(
       JSON.stringify({ success: true, action }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
 
   } catch (error) {
     console.error("Error processing campaign:", error);
     return new Response(
       JSON.stringify({ 
         success: false, 
         error: error instanceof Error ? error.message : "Unknown error" 
       }),
       {
         status: 500,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       }
     );
   }
 });