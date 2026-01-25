import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // For webhook validation (GET request from Melhor Envio)
    if (req.method === 'GET') {
      console.log('[melhor-envio-webhook] Validation request received');
      return new Response(
        JSON.stringify({ status: 'ok', message: 'Webhook endpoint active' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Process POST webhook
    const payload = await req.json();
    console.log('[melhor-envio-webhook] Received payload:', JSON.stringify(payload));

    const { event, data } = payload;

    if (!event || !data) {
      console.log('[melhor-envio-webhook] Missing event or data');
      return new Response(
        JSON.stringify({ success: true, message: 'Acknowledged' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Handle different event types
    switch (event) {
      case 'label.created':
      case 'label.updated':
      case 'shipment.tracking':
        await handleTrackingUpdate(supabase, data);
        break;
      
      case 'shipment.delivered':
        await handleDelivered(supabase, data);
        break;

      default:
        console.log(`[melhor-envio-webhook] Unhandled event type: ${event}`);
    }

    return new Response(
      JSON.stringify({ success: true, event }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[melhor-envio-webhook] Error:', errorMessage);
    // Always return 200 to prevent retry loops
    return new Response(
      JSON.stringify({ success: true, error: errorMessage }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function handleTrackingUpdate(supabase: any, data: any) {
  const { tracking_code, status, description } = data;
  
  if (!tracking_code) {
    console.log('[melhor-envio-webhook] No tracking code in data');
    return;
  }

  console.log(`[melhor-envio-webhook] Updating tracking for ${tracking_code}: ${status}`);

  // Update label status
  const { error } = await supabase
    .from('melhor_envio_labels')
    .update({
      status: status || 'tracking_updated',
      updated_at: new Date().toISOString(),
    })
    .eq('tracking_code', tracking_code);

  if (error) {
    console.error('[melhor-envio-webhook] Error updating label:', error);
  }
}

async function handleDelivered(supabase: any, data: any) {
  const { tracking_code } = data;
  
  if (!tracking_code) return;

  console.log(`[melhor-envio-webhook] Marking as delivered: ${tracking_code}`);

  // Update label as delivered
  const { data: label, error } = await supabase
    .from('melhor_envio_labels')
    .update({
      status: 'delivered',
      updated_at: new Date().toISOString(),
    })
    .eq('tracking_code', tracking_code)
    .select('sale_id')
    .single();

  if (error) {
    console.error('[melhor-envio-webhook] Error updating delivered status:', error);
    return;
  }

  // If linked to a sale, update sale status
  if (label?.sale_id) {
    await supabase
      .from('sales')
      .update({
        shipping_status: 'delivered',
        updated_at: new Date().toISOString(),
      })
      .eq('id', label.sale_id);
  }
}
