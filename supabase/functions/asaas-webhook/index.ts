import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, access_token",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Accept GET/HEAD for webhook validation
  if (req.method === "GET" || req.method === "HEAD") {
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("Asaas webhook received:", JSON.stringify(body));

    // Asaas sends payment updates
    const { event, payment } = body;

    if (!payment) {
      console.log("No payment data in payload");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get sale ID from external reference
    const saleId = payment.externalReference;

    if (!saleId) {
      console.log("No externalReference (sale_id) in payment");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('id, organization_id, total_cents, status, payment_status')
      .eq('id', saleId)
      .maybeSingle();

    if (!sale) {
      console.log(`Sale not found: ${saleId}`);
      return new Response(JSON.stringify({ received: true, message: 'Sale not found' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map Asaas event to status
    let newStatus = '';
    let paymentStatus = '';

    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        newStatus = 'payment_confirmed';
        paymentStatus = 'paid';
        break;
      case 'PAYMENT_OVERDUE':
        paymentStatus = 'overdue';
        break;
      case 'PAYMENT_DELETED':
      case 'PAYMENT_REFUNDED':
        newStatus = 'cancelled';
        paymentStatus = event === 'PAYMENT_REFUNDED' ? 'refunded' : 'cancelled';
        break;
      case 'PAYMENT_CHARGEBACK_REQUESTED':
      case 'PAYMENT_CHARGEBACK_DISPUTE':
        paymentStatus = 'chargeback';
        break;
      case 'PAYMENT_AWAITING_RISK_ANALYSIS':
        paymentStatus = 'analyzing';
        break;
      case 'PAYMENT_CREATED':
      case 'PAYMENT_UPDATED':
        // Keep as pending
        paymentStatus = 'pending';
        break;
      default:
        console.log(`Unknown event: ${event}`);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Update sale
    const updateData: Record<string, unknown> = {
      payment_status: paymentStatus,
    };

    if (newStatus) {
      updateData.status = newStatus;
    }

    // Add payment reference if available
    if (payment.id) {
      updateData.notes = `ASAAS ID: ${payment.id}`;
    }

    const { error: updateError } = await supabase
      .from('sales')
      .update(updateData)
      .eq('id', saleId);

    if (updateError) {
      console.error("Error updating sale:", updateError);
      throw updateError;
    }

    console.log(`Sale ${saleId} updated: status=${newStatus || 'unchanged'}, payment_status=${paymentStatus}`);

    // Log payment attempt
    await supabase
      .from('payment_attempts')
      .insert({
        sale_id: saleId,
        gateway: 'asaas',
        payment_method: payment.billingType?.toLowerCase() || 'unknown',
        amount_cents: Math.round((payment.value || 0) * 100),
        status: paymentStatus === 'paid' ? 'success' : paymentStatus === 'pending' ? 'pending' : 'failed',
        gateway_transaction_id: payment.id,
        attempt_number: 1,
        is_fallback: false,
        response_data: payment,
      });

    // If paid, process splits
    if (paymentStatus === 'paid') {
      await processSaleSplits(supabase, saleId);
    }

    return new Response(JSON.stringify({ success: true }), {
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
    
    // Credit affiliate account
    const { data: affAccount } = await supabase
      .from('virtual_accounts')
      .select('id, pending_balance_cents, total_received_cents')
      .eq('id', affiliateSplit.virtual_account_id)
      .single();

    if (affAccount) {
      // Create transaction
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

      // Update affiliate split with transaction id
      await supabase
        .from('sale_splits')
        .update({ transaction_id: (affTx as Record<string, unknown>)?.id })
        .eq('id', affiliateSplit.id);

      // Update pending balance
      await supabase
        .from('virtual_accounts')
        .update({
          pending_balance_cents: (affAccount.pending_balance_cents || 0) + affiliateSplitCents,
          total_received_cents: (affAccount.total_received_cents || 0) + affiliateSplitCents,
        })
        .eq('id', affAccount.id);
    }
  }

  // Calculate tenant amount
  const tenantAmount = totalCents - platformFeeCents - affiliateSplitCents;

  // Create tenant split record
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

  // Create tenant transaction
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

  // Update tenant pending balance
  await supabase
    .from('virtual_accounts')
    .update({
      pending_balance_cents: (tenantAccount.pending_balance_cents || 0) + tenantAmount,
      total_received_cents: (tenantAccount.total_received_cents || 0) + tenantAmount,
    })
    .eq('id', tenantAccount.id);

  // Create platform fee record
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
