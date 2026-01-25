import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processSaleSplitsV3, processRefundOrChargeback } from "./split-engine.ts";

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

    // Map status to our format FIRST to get stable eventType
    const { newStatus, paymentStatus, eventType } = mapStatus(status, gateway);
    
    // Build STABLE reference ID using SALE ID (not transaction ID!)
    // This prevents duplicate splits when gateway sends order.paid + charge.paid for same sale
    // Each logical sale should only ever create ONE set of splits
    const stableRef = `${gateway}:${saleId || 'unknown'}:${eventType}`;
    console.log(`[PaymentWebhook] Gateway: ${gateway}, SaleId: ${saleId}, TxId: ${transactionId}, RawStatus: ${status} -> EventType: ${eventType}, StableRef: ${stableRef}`);

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

    // Cast saleRecord fields with proper types (needed for fee calculation)
    const saleIdStr = saleRecord.id as string;
    const saleTotalCents = saleRecord.total_cents as number;

    // Status already mapped above (before stableRef)
    console.log(`[PaymentWebhook] Mapped status: ${status} -> ${paymentStatus} (event: ${eventType})`);

    // Update sale with payment status and gateway fee
    const updateData: Record<string, unknown> = {
      payment_status: paymentStatus,
    };

    if (newStatus) {
      updateData.status = newStatus;
    }

    if (transactionId) {
      updateData.gateway_transaction_id = transactionId;
      updateData.payment_notes = `${gateway.toUpperCase()} ID: ${transactionId}`;
    }

    // Save gateway fee (cost) when payment is confirmed
    if (eventType === 'paid' && feeCents && feeCents > 0) {
      updateData.gateway_fee_cents = feeCents;
      updateData.gateway_net_cents = (amountCents || saleTotalCents) - feeCents;
      console.log(`[PaymentWebhook] Gateway fee captured: ${feeCents} centavos`);
    }

    const { error: updateError } = await supabase
      .from('sales')
      .update(updateData)
      .eq('id', saleRecord.id);

    if (updateError) {
      console.error(`[PaymentWebhook] Failed to update sale ${saleRecord.id}:`, updateError);
    } else {
      console.log(`[PaymentWebhook] Sale ${saleRecord.id} updated: status=${newStatus || 'unchanged'}, payment_status=${paymentStatus}, gateway_fee=${feeCents || 0}`);
    }

    // Also update ecommerce_orders status when payment status changes
    if (eventType === 'paid') {
      await supabase
        .from('ecommerce_orders')
        .update({ 
          status: 'approved',
          paid_at: new Date().toISOString(),
          payment_transaction_id: transactionId || null,
          payment_gateway: gateway,
        })
        .eq('sale_id', saleRecord.id);
      
      // Update cart status to paid
      await supabase
        .from('ecommerce_carts')
        .update({ status: 'paid' })
        .eq('converted_sale_id', saleRecord.id);
    } else if (eventType === 'refunded') {
      await supabase
        .from('ecommerce_orders')
        .update({ status: 'refunded' })
        .eq('sale_id', saleRecord.id);
    } else if (eventType === 'chargedback') {
      await supabase
        .from('ecommerce_orders')
        .update({ status: 'chargeback' })
        .eq('sale_id', saleRecord.id);
    } else if (eventType === 'cancelled') {
      await supabase
        .from('ecommerce_orders')
        .update({ status: 'canceled' })
        .eq('sale_id', saleRecord.id);
    }

    // Log payment attempt (saleIdStr and saleTotalCents already declared above)

    // Log payment attempt
    await logPaymentAttempt(supabase, {
      saleId: saleIdStr,
      gateway,
      paymentMethod: paymentMethod || 'unknown',
      amountCents: amountCents || saleTotalCents,
      paymentStatus,
      transactionId,
      rawData,
      referenceId: stableRef,
    });

    // Process based on event type using STABLE reference ID
    switch (eventType) {
      case 'paid':
        await processSaleSplitsV3(supabase, saleIdStr, stableRef, {
          transactionId: transactionId || '',
          feeCents: feeCents || 0,
          netAmountCents: (amountCents || saleTotalCents) - (feeCents || 0),
          grossAmountCents: amountCents || saleTotalCents,
          settlementDate: null,
          paidAt: new Date().toISOString(),
          paymentMethod: paymentMethod || 'unknown',
          installments: 1,
        });

        // Send server-side conversion event (Purchase)
        await sendPurchaseConversion(supabase, saleIdStr, saleRecord.organization_id as string);
        break;

      case 'refunded':
        await processRefundOrChargeback(supabase, saleIdStr, stableRef, 'refund');
        break;

      case 'chargedback':
        await processRefundOrChargeback(supabase, saleIdStr, stableRef, 'chargeback');
        break;

      default:
        console.log(`[PaymentWebhook] No action for event type: ${eventType}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      gateway, 
      saleId: saleIdStr,
      eventType,
      referenceId: stableRef,
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

  // Pagar.me format (v5 core) - event wrapper with type + data
  // Examples seen in the wild:
  // - { id: 'hook_x', type: 'order.paid', data: { id: 'or_x', status: 'paid', code: '...', metadata: {...}, charges: [...] } }
  // - { type: 'charge.paid', data: { id: 'ch_x', status: 'paid', metadata: {...}, amount: 1234 } }
  if (typeof body.type === 'string' && body.data && typeof body.data === 'object') {
    const type = (body.type as string).toLowerCase();
    const rawData = body as Record<string, unknown>;

    // Heuristic: consider it Pagar.me if event looks like order.* or charge.* and payload resembles a core object
    if (type.startsWith('order.') || type.startsWith('charge.')) {
      const dataWrapper = body.data as Record<string, unknown>;
      const dataObj = (dataWrapper.object && typeof dataWrapper.object === 'object')
        ? (dataWrapper.object as Record<string, unknown>)
        : dataWrapper;

      const metadata = (dataObj.metadata && typeof dataObj.metadata === 'object')
        ? (dataObj.metadata as Record<string, unknown>)
        : {};

      // Try multiple places for sale id
      const saleId = (metadata.sale_id as string)
        || (dataObj.code as string)
        || ((Array.isArray(dataObj.items) ? (dataObj.items as Record<string, unknown>[])[0]?.code : null) as string)
        || null;

      const charges = Array.isArray(dataObj.charges) ? (dataObj.charges as Record<string, unknown>[]) : [];
      const charge0 = charges[0] || {};
      const lastTx = (charge0.last_transaction && typeof charge0.last_transaction === 'object')
        ? (charge0.last_transaction as Record<string, unknown>)
        : {};

      const status = (dataObj.status as string) || (charge0.status as string) || type;
      const transactionId = (dataObj.id as string) || (charge0.id as string) || null;
      const paymentMethod = (charge0.payment_method as string) || (dataObj.payment_method as string) || null;
      const amountCents = (charge0.amount as number) || (dataObj.amount as number) || null;

      const feeMaybe = (lastTx.gateway_fee ?? charge0.gateway_fee ?? 0) as number;

      return {
        gateway: 'pagarme',
        saleId,
        status,
        transactionId,
        paymentMethod,
        amountCents,
        feeCents: feeMaybe,
        rawData,
      };
    }
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

// =====================================================
// PURCHASE CONVERSION - Send to CAPI via server-side-conversions
// =====================================================
async function sendPurchaseConversion(
  supabase: SupabaseClient,
  saleId: string,
  organizationId: string
): Promise<void> {
  try {
    // Fetch sale with lead data
    const { data: sale } = await supabase
      .from('sales')
      .select(`
        id, total_cents, fbclid, gclid, ttclid, utm_source, utm_campaign,
        leads(name, email, whatsapp)
      `)
      .eq('id', saleId)
      .single();

    if (!sale) {
      console.log('[PaymentWebhook] Sale not found for conversion:', saleId);
      return;
    }

    // Fetch tracking config
    const { data: config } = await supabase
      .from('tracking_config')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!config || (!config.meta_enabled && !config.tiktok_enabled && !config.google_enabled)) {
      console.log('[PaymentWebhook] No tracking config for org:', organizationId);
      return;
    }

    const eventId = `${saleId}_purchase_${Date.now()}`;
    const lead = sale.leads as { name?: string; email?: string; whatsapp?: string } | null;

    // Send to Meta CAPI
    if (config.meta_enabled && config.meta_pixel_id && config.meta_access_token) {
      const userData: Record<string, any> = {};
      
      if (lead?.email) {
        userData.em = [await hashSHA256(lead.email)];
      }
      if (lead?.whatsapp) {
        userData.ph = [await hashSHA256(normalizePhoneForHash(lead.whatsapp))];
      }
      if (lead?.name) {
        const nameParts = lead.name.split(' ');
        userData.fn = [await hashSHA256(nameParts[0] || '')];
        if (nameParts.length > 1) {
          userData.ln = [await hashSHA256(nameParts.slice(1).join(' '))];
        }
      }
      if (sale.fbclid) {
        userData.fbc = `fb.1.${Date.now()}.${sale.fbclid}`;
      }

      const eventData = {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        user_data: userData,
        custom_data: {
          currency: 'BRL',
          value: (sale.total_cents || 0) / 100,
          content_type: 'product',
        },
      };

      const body: Record<string, any> = { data: [eventData] };
      if (config.meta_test_event_code) {
        body.test_event_code = config.meta_test_event_code;
      }

      const url = `https://graph.facebook.com/v18.0/${config.meta_pixel_id}/events?access_token=${config.meta_access_token}`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        console.log('[PaymentWebhook] Meta CAPI Purchase:', response.ok ? 'success' : 'failed', result);

        // Log conversion event
        await supabase.from('conversion_events').insert({
          organization_id: organizationId,
          sale_id: saleId,
          event_type: 'Purchase',
          platform: 'meta',
          event_id: eventId,
          status: response.ok ? 'sent' : 'failed',
          response: result,
          sent_at: response.ok ? new Date().toISOString() : null,
        });
      } catch (err) {
        console.error('[PaymentWebhook] Meta CAPI error:', err);
      }
    }

    // Send to TikTok
    if (config.tiktok_enabled && config.tiktok_pixel_id && config.tiktok_access_token) {
      const userData: Record<string, any> = {};
      
      if (lead?.email) {
        userData.email = await hashSHA256(lead.email);
      }
      if (lead?.whatsapp) {
        userData.phone = await hashSHA256(normalizePhoneForHash(lead.whatsapp));
      }
      if (sale.ttclid) {
        userData.ttclid = sale.ttclid;
      }

      const eventData = {
        event: 'CompletePayment',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        user: userData,
        properties: {
          currency: 'BRL',
          value: (sale.total_cents || 0) / 100,
        },
      };

      const url = 'https://business-api.tiktok.com/open_api/v1.3/pixel/track/';

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Access-Token': config.tiktok_access_token,
          },
          body: JSON.stringify({
            pixel_code: config.tiktok_pixel_id,
            data: [eventData],
          }),
        });
        const result = await response.json();
        console.log('[PaymentWebhook] TikTok Purchase:', result.code === 0 ? 'success' : 'failed', result);

        await supabase.from('conversion_events').insert({
          organization_id: organizationId,
          sale_id: saleId,
          event_type: 'Purchase',
          platform: 'tiktok',
          event_id: eventId,
          status: result.code === 0 ? 'sent' : 'failed',
          response: result,
          sent_at: result.code === 0 ? new Date().toISOString() : null,
        });
      } catch (err) {
        console.error('[PaymentWebhook] TikTok error:', err);
      }
    }

    // Send to Google GA4
    if (config.google_enabled && config.google_measurement_id && config.google_api_secret) {
      const clientId = `${Date.now()}.${Math.random()}`;
      
      const body = {
        client_id: clientId,
        events: [{
          name: 'purchase',
          params: {
            currency: 'BRL',
            value: (sale.total_cents || 0) / 100,
            transaction_id: saleId,
          },
        }],
      };

      const url = `https://www.google-analytics.com/mp/collect?measurement_id=${config.google_measurement_id}&api_secret=${config.google_api_secret}`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        console.log('[PaymentWebhook] GA4 Purchase:', response.status === 204 || response.ok ? 'success' : 'failed');

        await supabase.from('conversion_events').insert({
          organization_id: organizationId,
          sale_id: saleId,
          event_type: 'Purchase',
          platform: 'google',
          event_id: eventId,
          status: response.status === 204 || response.ok ? 'sent' : 'failed',
          sent_at: response.status === 204 || response.ok ? new Date().toISOString() : null,
        });
      } catch (err) {
        console.error('[PaymentWebhook] GA4 error:', err);
      }
    }

    console.log('[PaymentWebhook] Purchase conversion sent for sale:', saleId);
  } catch (error) {
    console.error('[PaymentWebhook] Error sending purchase conversion:', error);
  }
}

// SHA256 hash helper
async function hashSHA256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Normalize phone for hashing
function normalizePhoneForHash(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `55${cleaned.slice(1)}`;
  }
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `55${cleaned}`;
  }
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return cleaned;
  }
  return cleaned;
}
