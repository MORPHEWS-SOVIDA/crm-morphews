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

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error("Twilio credentials not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch phone numbers from Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json`;
    const authHeader = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const twilioResponse = await fetch(twilioUrl, {
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error("Twilio API error:", errorText);
      throw new Error(`Twilio API error: ${twilioResponse.status}`);
    }

    const twilioData = await twilioResponse.json();
    const incomingPhoneNumbers = twilioData.incoming_phone_numbers || [];

    console.log(`Found ${incomingPhoneNumbers.length} numbers in Twilio`);

    let imported = 0;
    let updated = 0;

    for (const number of incomingPhoneNumbers) {
      const phoneData = {
        phone_number: number.phone_number,
        phone_number_sid: number.sid,
        friendly_name: number.friendly_name,
        country_code: number.iso_country || "BR",
        region: number.address_requirements || null,
        locality: number.locality || null,
        capabilities: {
          voice: number.capabilities?.voice || false,
          sms: number.capabilities?.sms || false,
        },
      };

      // Check if number already exists
      const { data: existing } = await supabase
        .from("voice_phone_numbers")
        .select("id")
        .eq("phone_number", number.phone_number)
        .maybeSingle();

      if (existing) {
        // Update existing
        await supabase
          .from("voice_phone_numbers")
          .update({
            phone_number_sid: phoneData.phone_number_sid,
            friendly_name: phoneData.friendly_name,
            capabilities: phoneData.capabilities,
          })
          .eq("id", existing.id);
        updated++;
      } else {
        // Insert new
        await supabase
          .from("voice_phone_numbers")
          .insert({
            ...phoneData,
            status: "available",
            monthly_cost_cents: 5000, // Default R$ 50,00
          });
        imported++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: incomingPhoneNumbers.length,
        imported,
        updated,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error syncing Twilio numbers:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
