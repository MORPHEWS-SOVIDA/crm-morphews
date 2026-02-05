 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
     const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
     const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
     const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 
     if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
       return new Response(
         JSON.stringify({ error: "Twilio credentials not configured" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
 
     // Get request body
     const { phone_number_id, phone_number_sid } = await req.json();
 
     if (!phone_number_sid) {
       return new Response(
         JSON.stringify({ error: "phone_number_sid is required" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Configure webhooks for the phone number
     const voiceWebhookUrl = `${SUPABASE_URL}/functions/v1/twilio-voice-webhook`;
     const statusCallbackUrl = `${SUPABASE_URL}/functions/v1/twilio-call-status`;
 
     const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${phone_number_sid}.json`;
 
     const formData = new URLSearchParams();
     formData.append("VoiceUrl", voiceWebhookUrl);
     formData.append("VoiceMethod", "POST");
     formData.append("StatusCallback", statusCallbackUrl);
     formData.append("StatusCallbackMethod", "POST");
 
     const response = await fetch(twilioUrl, {
       method: "POST",
       headers: {
         "Authorization": `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
         "Content-Type": "application/x-www-form-urlencoded",
       },
       body: formData.toString(),
     });
 
     if (!response.ok) {
       const errorText = await response.text();
       console.error("Twilio API error:", errorText);
       return new Response(
         JSON.stringify({ error: "Failed to configure webhooks", details: errorText }),
         { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const twilioData = await response.json();
 
     // Update database to mark webhooks as configured
     if (phone_number_id) {
       await supabase
         .from("voice_phone_numbers")
         .update({ 
           webhooks_configured: true,
           updated_at: new Date().toISOString()
         })
         .eq("id", phone_number_id);
     }
 
     console.log(`Webhooks configured for ${twilioData.phone_number}`);
 
     return new Response(
       JSON.stringify({ 
         success: true, 
         phone_number: twilioData.phone_number,
         voice_url: twilioData.voice_url,
         status_callback: twilioData.status_callback
       }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
 
   } catch (error) {
     console.error("Error:", error);
     return new Response(
       JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });