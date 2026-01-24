import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * DEPRECATED: Pagarme Webhook
 * 
 * This webhook has been deprecated in favor of the unified payment-webhook.
 * All split processing and balance updates are handled by payment-webhook.
 * This ensures there's only ONE source of truth for payment processing.
 * 
 * ⚠️ IMPORTANT: Configure Pagar.me to send webhooks directly to:
 *    /functions/v1/payment-webhook
 * 
 * This endpoint now returns 200 OK and logs for monitoring.
 * It does NOT process splits or update balances.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const payload = JSON.parse(body);
    
    // Log for monitoring/debugging
    console.log("[PagarmeWebhook] DEPRECATED - Received event:", {
      id: payload.id,
      current_status: payload.current_status,
      sale_id: payload.metadata?.sale_id,
      timestamp: new Date().toISOString(),
    });

    console.warn("[PagarmeWebhook] ⚠️ This endpoint is deprecated. Please configure Pagar.me to use /functions/v1/payment-webhook instead.");

    // Best-effort forward to unified payment webhook so we don't depend on external reconfiguration.
    // This keeps backward compatibility with existing Pagar.me webhook settings.
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (supabaseUrl) {
        const forwardResp = await fetch(`${supabaseUrl}/functions/v1/payment-webhook`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-From": "pagarme-webhook",
          },
          body,
        });

        const forwardText = await forwardResp.text();
        console.log("[PagarmeWebhook] Forwarded to payment-webhook:", {
          status: forwardResp.status,
          body: forwardText.slice(0, 500),
        });
      }
    } catch (forwardError) {
      console.error("[PagarmeWebhook] Failed to forward to payment-webhook:", forwardError);
    }

    // Return 200 to prevent Pagar.me from retrying
    // The payment-webhook should be the one processing this event
    return new Response(
      JSON.stringify({ 
        received: true,
        deprecated: true,
        message: "This endpoint is deprecated. Please use /functions/v1/payment-webhook",
        redirect_to: "/functions/v1/payment-webhook"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[PagarmeWebhook] Error parsing payload:", error);
    
    // Still return 200 to prevent retries
    return new Response(
      JSON.stringify({ 
        received: true, 
        deprecated: true,
        error: "Parse error"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
