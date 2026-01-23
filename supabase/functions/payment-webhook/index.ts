import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Unified Payment Webhook
 * 
 * This endpoint can be used as a single webhook URL for all gateways.
 * It auto-detects the gateway based on the payload structure.
 * 
 * URL: /functions/v1/payment-webhook
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Accept GET/HEAD for validation
  if (req.method === "GET" || req.method === "HEAD") {
    return new Response(JSON.stringify({ status: "ok", message: "Payment webhook active" }), {
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

    console.log("Payment webhook received:", JSON.stringify(body).slice(0, 500));

    // Detect gateway and extract sale info
    const { gateway, saleId, status, transactionId, paymentMethod, amountCents, rawData } = detectGatewayAndExtract(body);

    if (!gateway) {
      console.log("Could not detect gateway from payload");
      return new Response(JSON.stringify({ received: true, message: "Unknown gateway format" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Detected gateway: ${gateway}, saleId: ${saleId}, status: ${status}`);

    if (!saleId) {
      console.log("No sale ID found in payload");
      return new Response(JSON.stringify({ received: true, message: "No sale ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find sale
    const { data: sale } = await supabase
      .from('sales')
      .select('id, organization_id, total_cents, status, payment_status')
      .eq('id', saleId)
      .maybeSingle();

    if (!sale) {
      // Try finding by notes
      const { data: salesByNote } = await supabase
        .from('sales')
        .select('id, organization_id, total_cents, status, payment_status')
        .ilike('notes', `%${saleId}%`)
        .limit(1);

      if (!salesByNote?.length) {
        console.log(`Sale not found: ${saleId}`);
        return new Response(JSON.stringify({ received: true, message: "Sale not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const saleRecord = sale || (await supabase
      .from('sales')
      .select('id, organization_id, total_cents, status, payment_status')
      .ilike('notes', `%${saleId}%`)
      .limit(1)
      .single()).data;

    if (!saleRecord) {
      return new Response(JSON.stringify({ received: true, message: "Sale not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map status to our format
    const { newStatus, paymentStatus } = mapStatus(status, gateway);

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

    console.log(`Sale ${saleRecord.id} updated: status=${newStatus || 'unchanged'}, payment_status=${paymentStatus}`);

    // Log payment attempt
    await supabase
      .from('payment_attempts')
      .insert({
        sale_id: saleRecord.id,
        gateway,
        payment_method: paymentMethod || 'unknown',
        amount_cents: amountCents || saleRecord.total_cents,
        status: paymentStatus === 'paid' ? 'success' : paymentStatus === 'pending' ? 'pending' : 'failed',
        gateway_transaction_id: transactionId,
        attempt_number: 1,
        is_fallback: false,
        response_data: rawData,
      });

    // If paid, process splits
    if (paymentStatus === 'paid') {
      await processSaleSplits(supabase, saleRecord.id);
    }

    return new Response(JSON.stringify({ success: true, gateway, saleId: saleRecord.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface ExtractedData {
  gateway: string | null;
  saleId: string | null;
  status: string;
  transactionId: string | null;
  paymentMethod: string | null;
  amountCents: number | null;
  rawData: Record<string, unknown>;
}

function detectGatewayAndExtract(body: Record<string, unknown>): ExtractedData {
  // Pagarme format
  if (body.current_status !== undefined && body.metadata) {
    const metadata = body.metadata as Record<string, unknown>;
    return {
      gateway: 'pagarme',
      saleId: metadata.sale_id as string || null,
      status: body.current_status as string,
      transactionId: String(body.id || ''),
      paymentMethod: body.payment_method as string || null,
      amountCents: body.amount as number || null,
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
    rawData: body,
  };
}

function mapStatus(rawStatus: string, gateway: string): { newStatus: string; paymentStatus: string } {
  const status = rawStatus.toLowerCase();

  // Paid statuses
  if (['paid', 'approved', 'captured', 'payment_confirmed', 'payment_received',
       'payment_intent.succeeded', 'charge.succeeded'].some(s => status.includes(s))) {
    return { newStatus: 'payment_confirmed', paymentStatus: 'paid' };
  }

  // Refunded
  if (['refunded', 'payment_refunded', 'charge.refunded'].some(s => status.includes(s))) {
    return { newStatus: 'cancelled', paymentStatus: 'refunded' };
  }

  // Cancelled/Failed
  if (['refused', 'cancelled', 'denied', 'failed', 'chargedback', 'payment_deleted',
       'payment_intent.payment_failed', 'charge.failed'].some(s => status.includes(s))) {
    return { newStatus: 'cancelled', paymentStatus: 'cancelled' };
  }

  // Analyzing
  if (['analyzing', 'awaiting_risk_analysis', 'review'].some(s => status.includes(s))) {
    return { newStatus: '', paymentStatus: 'analyzing' };
  }

  // Pending
  if (['pending', 'waiting', 'processing', 'authorized', 'created', 'updated',
       'payment_intent.created', 'payment_intent.processing'].some(s => status.includes(s))) {
    return { newStatus: '', paymentStatus: 'pending' };
  }

  return { newStatus: '', paymentStatus: 'pending' };
}

async function processSaleSplits(supabase: SupabaseClient, saleId: string) {
  // Fetch sale details
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('id, organization_id, total_cents')
    .eq('id', saleId)
    .single();

  if (saleError || !sale) {
    console.error("Error fetching sale:", saleError);
    return;
  }

  // Check if splits already processed
  const { data: existingSplits } = await supabase
    .from('sale_splits')
    .select('id')
    .eq('sale_id', saleId)
    .eq('split_type', 'tenant');

  if (existingSplits && existingSplits.length > 0) {
    console.log(`Splits already processed for sale ${saleId}`);
    return;
  }

  // Fetch platform settings
  const { data: platformSettings } = await supabase
    .from('platform_settings')
    .select('setting_key, setting_value');

  const settings = (platformSettings || []).reduce((acc: Record<string, unknown>, s: Record<string, unknown>) => {
    acc[s.setting_key as string] = s.setting_value;
    return acc;
  }, {} as Record<string, unknown>);

  const platformFees = (settings.platform_fees as { percentage?: number; fixed_cents?: number }) || { percentage: 5.0, fixed_cents: 0 };
  const withdrawalRules = (settings.withdrawal_rules as { release_days?: number }) || { release_days: 14 };

  const totalCents = sale.total_cents;
  const platformFeeCents = Math.round(totalCents * ((platformFees.percentage || 5) / 100)) + (platformFees.fixed_cents || 0);
  
  // Release date
  const releaseAt = new Date();
  releaseAt.setDate(releaseAt.getDate() + (withdrawalRules.release_days || 14));

  // Get or create tenant virtual account
  let { data: tenantAccount } = await supabase
    .from('virtual_accounts')
    .select('id, pending_balance_cents, total_received_cents')
    .eq('organization_id', sale.organization_id)
    .eq('account_type', 'tenant')
    .maybeSingle();

  if (!tenantAccount) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name, email')
      .eq('id', sale.organization_id)
      .single();

    const { data: newAccount } = await supabase
      .from('virtual_accounts')
      .insert({
        organization_id: sale.organization_id,
        account_type: 'tenant',
        holder_name: (org as Record<string, unknown>)?.name || 'Tenant',
        holder_email: (org as Record<string, unknown>)?.email || 'tenant@example.com',
        pending_balance_cents: 0,
        total_received_cents: 0,
      })
      .select('id, pending_balance_cents, total_received_cents')
      .single();

    tenantAccount = newAccount;
  }

  if (!tenantAccount) {
    console.error("Failed to get/create tenant account");
    return;
  }

  // Check for existing affiliate split
  const { data: affiliateSplits } = await supabase
    .from('sale_splits')
    .select('*')
    .eq('sale_id', saleId)
    .eq('split_type', 'affiliate');

  let affiliateSplitCents = 0;
  const affiliateSplit = (affiliateSplits as Record<string, unknown>[])?.[0];
  
  if (affiliateSplit) {
    affiliateSplitCents = affiliateSplit.gross_amount_cents as number || 0;
    
    const { data: affAccount } = await supabase
      .from('virtual_accounts')
      .select('id, pending_balance_cents, total_received_cents')
      .eq('id', affiliateSplit.virtual_account_id)
      .single();

    if (affAccount) {
      const { data: affTx } = await supabase
        .from('virtual_transactions')
        .insert({
          virtual_account_id: affAccount.id,
          sale_id: saleId,
          transaction_type: 'credit',
          amount_cents: affiliateSplitCents,
          fee_cents: 0,
          net_amount_cents: affiliateSplitCents,
          description: `Comissão venda #${saleId.slice(0, 8)}`,
          status: 'pending',
          release_at: releaseAt.toISOString(),
        })
        .select('id')
        .single();

      await supabase
        .from('sale_splits')
        .update({ transaction_id: (affTx as Record<string, unknown>)?.id })
        .eq('id', affiliateSplit.id);

      await supabase
        .from('virtual_accounts')
        .update({
          pending_balance_cents: (affAccount.pending_balance_cents || 0) + affiliateSplitCents,
          total_received_cents: (affAccount.total_received_cents || 0) + affiliateSplitCents,
        })
        .eq('id', affAccount.id);
    }
  }

  const tenantAmount = totalCents - platformFeeCents - affiliateSplitCents;

  await supabase
    .from('sale_splits')
    .insert({
      sale_id: saleId,
      virtual_account_id: tenantAccount.id,
      split_type: 'tenant',
      gross_amount_cents: totalCents - affiliateSplitCents,
      fee_cents: platformFeeCents,
      net_amount_cents: tenantAmount,
      percentage: 100 - (affiliateSplitCents / totalCents * 100),
    });

  await supabase
    .from('virtual_transactions')
    .insert({
      virtual_account_id: tenantAccount.id,
      sale_id: saleId,
      transaction_type: 'credit',
      amount_cents: tenantAmount,
      fee_cents: platformFeeCents,
      net_amount_cents: tenantAmount,
      description: `Venda #${saleId.slice(0, 8)} (- taxa plataforma)`,
      status: 'pending',
      release_at: releaseAt.toISOString(),
    });

  await supabase
    .from('virtual_accounts')
    .update({
      pending_balance_cents: (tenantAccount.pending_balance_cents || 0) + tenantAmount,
      total_received_cents: (tenantAccount.total_received_cents || 0) + tenantAmount,
    })
    .eq('id', tenantAccount.id);

  await supabase
    .from('sale_splits')
    .insert({
      sale_id: saleId,
      virtual_account_id: tenantAccount.id,
      split_type: 'platform',
      gross_amount_cents: platformFeeCents,
      fee_cents: 0,
      net_amount_cents: platformFeeCents,
      percentage: platformFees.percentage || 5,
    });

  console.log(`Processed splits for sale ${saleId}: Tenant=${tenantAmount}, Affiliate=${affiliateSplitCents}, Platform=${platformFeeCents}`);
}
