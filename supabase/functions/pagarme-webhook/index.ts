import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * DEPRECATED: Pagarme Webhook Proxy
 * 
 * This webhook has been deprecated in favor of the unified payment-webhook.
 * It now acts as a simple proxy that forwards requests to payment-webhook.
 * 
 * All split processing and balance updates are handled by payment-webhook.
 * This ensures there's only ONE source of truth for payment processing.
 * 
 * ⚠️ IMPORTANT: Configure Pagar.me to send webhooks directly to:
 *    /functions/v1/payment-webhook
 * 
 * This endpoint exists for backward compatibility only.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  
  try {
    const body = await req.text();
    console.log("[PagarmeWebhook] DEPRECATED - Forwarding to payment-webhook");
    console.log("[PagarmeWebhook] Payload preview:", body.slice(0, 500));

    // Forward to the unified payment webhook
    const paymentWebhookUrl = `${supabaseUrl}/functions/v1/payment-webhook`;
    
    const response = await fetch(paymentWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('Authorization') || '',
      },
      body,
    });

    const result = await response.text();
    console.log("[PagarmeWebhook] payment-webhook response:", response.status, result.slice(0, 200));

    return new Response(result, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[PagarmeWebhook] Error forwarding:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Still return 200 to Pagar.me to prevent retries
    // The actual processing happens in payment-webhook
    return new Response(
      JSON.stringify({ 
        received: true, 
        forwarded: false,
        error: errorMessage,
        message: "This endpoint is deprecated. Please use /functions/v1/payment-webhook"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
