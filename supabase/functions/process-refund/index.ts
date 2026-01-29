import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processRefundSplits } from "../_shared/refund-processor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Process Refund Edge Function
 * 
 * Handles refund requests from the order detail page.
 * - Calls Pagar.me gateway for refund
 * - Uses shared refund processor to reverse ALL partner splits
 * - Updates sale/order status
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sale_id, order_id, amount_cents, reason, notify_customer, refund_type } = await req.json();

    if (!sale_id || !amount_cents) {
      throw new Error("sale_id e amount_cents são obrigatórios");
    }

    console.log(`[ProcessRefund] Processing refund for sale ${sale_id}, amount: ${amount_cents}, type: ${refund_type}`);

    // 1. Get sale info
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('id, organization_id, total_cents, payment_status, status, gateway_transaction_id')
      .eq('id', sale_id)
      .single();

    if (saleError || !sale) {
      throw new Error("Venda não encontrada");
    }

    if (sale.payment_status !== 'paid') {
      throw new Error("Somente vendas pagas podem ser reembolsadas");
    }

    // 2. Get platform gateway config for API call
    const { data: gatewayConfig } = await supabase
      .from('platform_gateway_config')
      .select('*')
      .eq('is_active', true)
      .eq('gateway_type', 'pagarme')
      .single();

    if (!gatewayConfig) {
      console.warn("[ProcessRefund] No gateway config found, updating status only");
    }

    // 3. Call gateway refund API (Pagar.me)
    let gatewayRefundSuccess = false;
    let gatewayRefundId: string | null = null;

    if (gatewayConfig && sale.gateway_transaction_id) {
      try {
        const apiKey = gatewayConfig.api_key_encrypted;
        
        // Pagar.me V5 refund endpoint
        const refundResponse = await fetch(
          `https://api.pagar.me/core/v5/orders/${sale.gateway_transaction_id}/refunds`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(apiKey + ':')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: amount_cents,
              metadata: {
                sale_id,
                reason,
                refund_type,
              },
            }),
          }
        );

        if (refundResponse.ok) {
          const refundData = await refundResponse.json();
          gatewayRefundSuccess = true;
          gatewayRefundId = refundData.id;
          console.log(`[ProcessRefund] Gateway refund successful: ${gatewayRefundId}`);
        } else {
          const errorData = await refundResponse.text();
          console.error(`[ProcessRefund] Gateway refund failed: ${errorData}`);
        }
      } catch (gatewayError) {
        console.error("[ProcessRefund] Gateway API error:", gatewayError);
      }
    }

    // 4. CRITICAL: Process refund splits - debits ALL liable partner accounts
    const refundReferenceId = `manual-refund:${sale_id}:${Date.now()}`;
    
    console.log(`[ProcessRefund] Processing split reversals...`);
    const splitResult = await processRefundSplits(supabase, sale_id, refundReferenceId, 'refund');
    console.log(`[ProcessRefund] Split reversals completed - debited ${splitResult.debited} accounts`);

    if (splitResult.errors.length > 0) {
      console.warn(`[ProcessRefund] Split errors:`, splitResult.errors);
    }

    // 5. Update ecommerce_order status (sale status already updated by split processor)
    const newStatus = refund_type === 'total' ? 'refunded' : 'partial_refund';
    
    if (order_id) {
      await supabase
        .from('ecommerce_orders')
        .update({
          status: newStatus,
          canceled_at: new Date().toISOString(),
          internal_notes: `Reembolso: ${reason || 'Sem motivo informado'}`,
        })
        .eq('id', order_id);
    }

    // 6. Create refund record in payment_attempts for audit trail
    await supabase
      .from('payment_attempts')
      .insert({
        sale_id,
        gateway_type: gatewayConfig?.gateway_type || 'manual',
        payment_method: 'refund',
        amount_cents,
        status: gatewayRefundSuccess ? 'approved' : 'error',
        gateway_transaction_id: gatewayRefundId,
        is_fallback: false,
        attempt_number: 1,
        response_data: {
          refund_type,
          reason,
          notify_customer,
          gateway_success: gatewayRefundSuccess,
          splits_debited: splitResult.debited,
          split_errors: splitResult.errors,
        },
      });

    // 7. TODO: Send notification email if notify_customer is true
    if (notify_customer) {
      console.log(`[ProcessRefund] Customer notification requested but not implemented yet`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: gatewayRefundId,
        gateway_processed: gatewayRefundSuccess,
        amount_cents,
        refund_type,
        splits_reversed: splitResult.debited,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ProcessRefund] Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
