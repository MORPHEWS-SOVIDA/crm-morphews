import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * cancel-expired-orders
 * 
 * Cron job that runs every 10 minutes to cancel ecommerce orders
 * that have been awaiting_payment for more than 1 hour.
 * 
 * Orders are canceled but NO sale is deleted since sales are only
 * created after payment is confirmed.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    console.log(`[CancelExpiredOrders] Looking for orders older than ${oneHourAgo}`);

    // Find orders that are awaiting_payment and older than 1 hour
    const { data: expiredOrders, error: fetchError } = await supabase
      .from('ecommerce_orders')
      .select('id, order_number, created_at, lead_id, organization_id, sale_id')
      .eq('status', 'awaiting_payment')
      .lt('created_at', oneHourAgo)
      .limit(100);

    if (fetchError) {
      console.error('[CancelExpiredOrders] Error fetching orders:', fetchError);
      throw fetchError;
    }

    if (!expiredOrders || expiredOrders.length === 0) {
      console.log('[CancelExpiredOrders] No expired orders found');
      return new Response(
        JSON.stringify({ success: true, canceled: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CancelExpiredOrders] Found ${expiredOrders.length} expired orders to cancel`);

    // Cancel each order
    const now = new Date().toISOString();
    const orderIds = expiredOrders.map(o => o.id);

    const { error: updateError } = await supabase
      .from('ecommerce_orders')
      .update({
        status: 'canceled',
        canceled_at: now,
        internal_notes: 'Cancelado automaticamente após 1 hora sem pagamento',
      })
      .in('id', orderIds);

    if (updateError) {
      console.error('[CancelExpiredOrders] Error updating orders:', updateError);
      throw updateError;
    }

    // Also cancel the associated sales (they are in ecommerce_pending status)
    const saleIds = expiredOrders
      .map(o => o.sale_id)
      .filter(Boolean) as string[];

    if (saleIds.length > 0) {
      const { error: salesError } = await supabase
        .from('sales')
        .update({ 
          status: 'cancelled',
          payment_status: 'cancelled',
        })
        .in('id', saleIds)
        .eq('status', 'ecommerce_pending'); // Only cancel if still in pending status

      if (salesError) {
        console.error('[CancelExpiredOrders] Error cancelling sales:', salesError);
      } else {
        console.log(`[CancelExpiredOrders] Cancelled ${saleIds.length} associated sales`);
      }
    }

    // Also update any related carts to expired
    const cartIds = expiredOrders
      .map(o => o.id)
      .filter(Boolean);
    
    if (cartIds.length > 0) {
      await supabase
        .from('ecommerce_carts')
        .update({ status: 'expired' })
        .in('id', cartIds);
    }

    console.log(`[CancelExpiredOrders] Successfully canceled ${expiredOrders.length} orders`);

    // Log details for monitoring
    for (const order of expiredOrders) {
      console.log(`[CancelExpiredOrders] Canceled order ${order.order_number} (created: ${order.created_at})`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        canceled: expiredOrders.length,
        orders: expiredOrders.map(o => o.order_number),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[CancelExpiredOrders] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
