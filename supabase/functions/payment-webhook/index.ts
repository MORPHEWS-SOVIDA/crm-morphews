import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildReferenceId, processSaleSplitsV3, processRefundOrChargeback, isUniqueViolation } from "./split-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Unified Payment Webhook - SOURCE OF TRUTH for all payment processing
 * 
 * This is the ONLY endpoint that should process splits and update balances.
 * Other gateway-specific webhooks (pagarme-webhook, stripe-webhook) should
 * forward to this handler or be deprecated.
 * 
 * URL: /functions/v1/payment-webhook
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Accept GET/HEAD for validation
  if (req.method === "GET" || req.method === "HEAD") {
    return new Response(JSON.stringify({ status: "ok", message: "Payment webhook active (v3)" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const bodyText = await req.text();
    let body: Record<string, unknown>;

    try {
      body = JSON.parse(bodyText);
    } catch {
      console.error("Invalid JSON payload");
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[PaymentWebhook] Received:", JSON.stringify(body).slice(0, 1000));

    // Detect gateway and extract sale info
    const extracted = detectGatewayAndExtract(body);
    const { gateway, saleId, status, transactionId, paymentMethod, amountCents, rawData, feeCents } = extracted;

    if (!gateway) {
      console.log("[PaymentWebhook] Could not detect gateway from payload");
      return new Response(JSON.stringify({ received: true, message: "Unknown gateway format" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build unique reference ID for idempotency
    const referenceId = buildReferenceId(gateway, body);
    console.log(`[PaymentWebhook] Gateway: ${gateway}, SaleId: ${saleId}, Status: ${status}, RefId: ${referenceId}`);

    if (!saleId) {
      console.log("[PaymentWebhook] No sale ID found in payload");
      return new Response(JSON.stringify({ received: true, message: "No sale ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find sale by ID or by notes containing the ID
    const saleRecord = await findSale(supabase, saleId);
    if (!saleRecord) {
      console.log(`[PaymentWebhook] Sale not found: ${saleId}`);
      return new Response(JSON.stringify({ received: true, message: "Sale not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map status to our format
    const { newStatus, paymentStatus, eventType } = mapStatus(status, gateway);
    console.log(`[PaymentWebhook] Mapped status: ${status} -> ${paymentStatus} (event: ${eventType})`);

    // Update sale
    const updateData: Record<string, unknown> = {
      payment_status: paymentStatus,
    };

    if (newStatus) {
      updateData.status = newStatus;
    }

    if (transactionId) {
      updateData.notes = `${gateway.toUpperCase()} ID: ${transactionId}`;
    }

    await supabase
      .from('sales')
      .update(updateData)
      .eq('id', saleRecord.id);

    console.log(`[PaymentWebhook] Sale ${saleRecord.id} updated: status=${newStatus || 'unchanged'}, payment_status=${paymentStatus}`);

    // Cast saleRecord fields with proper types
    const saleIdStr = saleRecord.id as string;
    const saleTotalCents = saleRecord.total_cents as number;

    // Log payment attempt
    await logPaymentAttempt(supabase, {
      saleId: saleIdStr,
      gateway,
      paymentMethod: paymentMethod || 'unknown',
      amountCents: amountCents || saleTotalCents,
      paymentStatus,
      transactionId,
      rawData,
      referenceId,
    });

    // Process based on event type
    switch (eventType) {
      case 'paid':
        await processSaleSplitsV3(supabase, saleIdStr, referenceId, {
          transactionId: transactionId || '',
          feeCents: feeCents || 0,
          netAmountCents: (amountCents || saleTotalCents) - (feeCents || 0),
          grossAmountCents: amountCents || saleTotalCents,
          settlementDate: null,
          paidAt: new Date().toISOString(),
          paymentMethod: paymentMethod || 'unknown',
          installments: 1,
        });
        break;

      case 'refunded':
        await processRefundOrChargeback(supabase, saleIdStr, referenceId, 'refund');
        break;

      case 'chargedback':
        await processRefundOrChargeback(supabase, saleIdStr, referenceId, 'chargeback');
        break;

      default:
        console.log(`[PaymentWebhook] No action for event type: ${eventType}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      gateway, 
      saleId: saleIdStr,
      eventType,
      referenceId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[PaymentWebhook] Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

interface ExtractedData {
  gateway: string | null;
  saleId: string | null;
  status: string;
  transactionId: string | null;
  paymentMethod: string | null;
  amountCents: number | null;
  feeCents: number | null;
  rawData: Record<string, unknown>;
}

function detectGatewayAndExtract(body: Record<string, unknown>): ExtractedData {
  // Pagarme format (v4 legacy)
  if (body.current_status !== undefined && body.metadata) {
    const metadata = body.metadata as Record<string, unknown>;
    const transaction = body as Record<string, unknown>;
    const lastTx = (transaction.last_transaction || {}) as Record<string, unknown>;
    
    return {
      gateway: 'pagarme',
      saleId: metadata.sale_id as string || null,
      status: body.current_status as string,
      transactionId: String(body.id || ''),
      paymentMethod: body.payment_method as string || null,
      amountCents: body.amount as number || null,
      feeCents: (lastTx.gateway_fee || transaction.gateway_fee || 0) as number,
      rawData: body,
    };
  }

  // Appmax format
  if (body.event !== undefined && body.data) {
    const data = body.data as Record<string, unknown>;
    return {
      gateway: 'appmax',
      saleId: (data.external_id || data.order_id) as string || null,
      status: (data.status as string || body.event as string || '').toLowerCase(),
      transactionId: String(data.order_id || data.id || ''),
      paymentMethod: null,
      amountCents: data.total ? Math.round((data.total as number) * 100) : null,
      feeCents: null,
      rawData: body,
    };
  }

  // Asaas format
  if (body.payment !== undefined && body.event) {
    const payment = body.payment as Record<string, unknown>;
    return {
      gateway: 'asaas',
      saleId: payment.externalReference as string || null,
      status: body.event as string,
      transactionId: payment.id as string || null,
      paymentMethod: (payment.billingType as string || '').toLowerCase(),
      amountCents: payment.value ? Math.round((payment.value as number) * 100) : null,
      feeCents: null,
      rawData: body,
    };
  }

  // Stripe format (PaymentIntent)
  if (body.type && (body.type as string).startsWith('payment_intent')) {
    const data = (body.data as Record<string, unknown>)?.object as Record<string, unknown> || {};
    const metadata = data.metadata as Record<string, unknown> || {};
    return {
      gateway: 'stripe',
      saleId: metadata.sale_id as string || null,
      status: body.type as string,
      transactionId: data.id as string || null,
      paymentMethod: 'card',
      amountCents: data.amount as number || null,
      feeCents: null,
      rawData: body,
    };
  }

  // Stripe format (Charge)
  if (body.type && (body.type as string).startsWith('charge')) {
    const data = (body.data as Record<string, unknown>)?.object as Record<string, unknown> || {};
    const metadata = data.metadata as Record<string, unknown> || {};
    return {
      gateway: 'stripe',
      saleId: metadata.sale_id as string || null,
      status: body.type as string,
      transactionId: data.id as string || null,
      paymentMethod: 'card',
      amountCents: data.amount as number || null,
      feeCents: null,
      rawData: body,
    };
  }

  return {
    gateway: null,
    saleId: null,
    status: '',
    transactionId: null,
    paymentMethod: null,
    amountCents: null,
    feeCents: null,
    rawData: body,
  };
}

interface StatusMapping {
  newStatus: string;
  paymentStatus: string;
  eventType: 'paid' | 'pending' | 'refunded' | 'chargedback' | 'cancelled' | 'unknown';
}

function mapStatus(rawStatus: string, gateway: string): StatusMapping {
  const status = rawStatus.toLowerCase();

  // Paid statuses
  if (['paid', 'approved', 'captured', 'payment_confirmed', 'payment_received',
       'payment_intent.succeeded', 'charge.succeeded'].some(s => status.includes(s))) {
    return { newStatus: 'payment_confirmed', paymentStatus: 'paid', eventType: 'paid' };
  }

  // Refunded
  if (['refunded', 'payment_refunded', 'charge.refunded'].some(s => status.includes(s))) {
    return { newStatus: 'cancelled', paymentStatus: 'refunded', eventType: 'refunded' };
  }

  // Chargedback
  if (['chargedback', 'chargeback', 'dispute'].some(s => status.includes(s))) {
    return { newStatus: 'cancelled', paymentStatus: 'chargedback', eventType: 'chargedback' };
  }

  // Cancelled/Failed
  if (['refused', 'cancelled', 'denied', 'failed', 'payment_deleted',
       'payment_intent.payment_failed', 'charge.failed'].some(s => status.includes(s))) {
    return { newStatus: 'cancelled', paymentStatus: 'cancelled', eventType: 'cancelled' };
  }

  // Analyzing
  if (['analyzing', 'awaiting_risk_analysis', 'review'].some(s => status.includes(s))) {
    return { newStatus: '', paymentStatus: 'analyzing', eventType: 'pending' };
  }

  // Pending
  if (['pending', 'waiting', 'processing', 'authorized', 'created', 'updated',
       'payment_intent.created', 'payment_intent.processing'].some(s => status.includes(s))) {
    return { newStatus: '', paymentStatus: 'pending', eventType: 'pending' };
  }

  return { newStatus: '', paymentStatus: 'pending', eventType: 'unknown' };
}

async function findSale(supabase: SupabaseClient, saleId: string): Promise<Record<string, unknown> | null> {
  // Try direct ID match
  const { data: sale } = await supabase
    .from('sales')
    .select('id, organization_id, total_cents, status, payment_status')
    .eq('id', saleId)
    .maybeSingle();

  if (sale) return sale;

  // Try finding by notes containing the ID
  const { data: salesByNote } = await supabase
    .from('sales')
    .select('id, organization_id, total_cents, status, payment_status')
    .ilike('notes', `%${saleId}%`)
    .limit(1);

  return salesByNote?.[0] || null;
}

interface LogParams {
  saleId: string;
  gateway: string;
  paymentMethod: string;
  amountCents: number;
  paymentStatus: string;
  transactionId: string | null;
  rawData: Record<string, unknown>;
  referenceId: string;
}

async function logPaymentAttempt(supabase: SupabaseClient, params: LogParams): Promise<void> {
  const { saleId, gateway, paymentMethod, amountCents, paymentStatus, transactionId, rawData, referenceId } = params;

  try {
    await supabase
      .from('payment_attempts')
      .insert({
        sale_id: saleId,
        gateway_type: gateway,
        payment_method: paymentMethod,
        amount_cents: amountCents,
        status: paymentStatus === 'paid' ? 'success' : paymentStatus === 'pending' ? 'pending' : 'failed',
        gateway_transaction_id: transactionId,
        attempt_number: 1,
        is_fallback: false,
        response_data: { ...rawData, reference_id: referenceId },
      });
  } catch (error) {
    console.error('[PaymentWebhook] Error logging payment attempt:', error);
  }
}
