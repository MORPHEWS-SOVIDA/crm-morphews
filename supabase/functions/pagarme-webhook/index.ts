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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("Pagarme webhook received:", JSON.stringify(body));

    // Pagarme sends transaction updates
    const { id, current_status, metadata } = body;
    const saleId = metadata?.sale_id;

    if (!saleId) {
      console.log("No sale_id in metadata, ignoring");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map Pagarme status to our status
    let newStatus = '';
    let paymentStatus = '';

    switch (current_status) {
      case 'paid':
        newStatus = 'confirmed';
        paymentStatus = 'paid';
        break;
      case 'refused':
      case 'refunded':
      case 'chargedback':
        newStatus = 'cancelled';
        paymentStatus = current_status === 'refunded' ? 'refunded' : 'cancelled';
        break;
      case 'pending_refund':
        paymentStatus = 'pending_refund';
        break;
      case 'waiting_payment':
      case 'processing':
      case 'authorized':
        // Keep as pending
        paymentStatus = 'pending';
        break;
      default:
        console.log(`Unknown status: ${current_status}`);
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

    const { error: updateError } = await supabase
      .from('sales')
      .update(updateData)
      .eq('id', saleId);

    if (updateError) {
      console.error("Error updating sale:", updateError);
      throw updateError;
    }

    // If paid, process splits
    if (current_status === 'paid') {
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

async function processSaleSplits(supabase: any, saleId: string) {
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

  // Fetch platform settings
  const { data: platformSettings } = await supabase
    .from('platform_settings')
    .select('setting_key, setting_value');

  const settings = (platformSettings || []).reduce((acc: Record<string, any>, s: any) => {
    acc[s.setting_key] = s.setting_value;
    return acc;
  }, {});

  const platformFees = settings.platform_fees || { percentage: 5.0, fixed_cents: 0 };
  const withdrawalRules = settings.withdrawal_rules || { release_days: 14 };

  const totalCents = sale.total_cents;
  const platformFeeCents = Math.round(totalCents * (platformFees.percentage / 100)) + (platformFees.fixed_cents || 0);
  
  // Release date
  const releaseAt = new Date();
  releaseAt.setDate(releaseAt.getDate() + (withdrawalRules.release_days || 14));

  // Get tenant virtual account
  let { data: tenantAccount } = await supabase
    .from('virtual_accounts')
    .select('id')
    .eq('organization_id', sale.organization_id)
    .eq('account_type', 'tenant')
    .maybeSingle();

  // Create tenant account if not exists
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
        holder_name: org?.name || 'Tenant',
        holder_email: org?.email || 'tenant@morphews.com',
      })
      .select('id')
      .single();

    tenantAccount = newAccount;
  }

  // Check for existing affiliate split
  const { data: existingSplits } = await supabase
    .from('sale_splits')
    .select('*')
    .eq('sale_id', saleId);

  let affiliateSplitCents = 0;
  const affiliateSplit = existingSplits?.find((s: any) => s.split_type === 'affiliate');
  
  if (affiliateSplit) {
    affiliateSplitCents = affiliateSplit.gross_amount_cents;
    
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
        .update({ transaction_id: affTx?.id })
        .eq('id', affiliateSplit.id);

      // Update pending balance
      await supabase
        .from('virtual_accounts')
        .update({
          pending_balance_cents: affAccount.pending_balance_cents + affiliateSplitCents,
          total_received_cents: affAccount.total_received_cents + affiliateSplitCents,
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
  const { data: tenantTx } = await supabase
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
    })
    .select('id')
    .single();

  // Update tenant pending balance
  const { data: tenantAccountData } = await supabase
    .from('virtual_accounts')
    .select('pending_balance_cents, total_received_cents')
    .eq('id', tenantAccount.id)
    .single();

  await supabase
    .from('virtual_accounts')
    .update({
      pending_balance_cents: (tenantAccountData?.pending_balance_cents || 0) + tenantAmount,
      total_received_cents: (tenantAccountData?.total_received_cents || 0) + tenantAmount,
    })
    .eq('id', tenantAccount.id);

  // Create platform fee record (for accounting)
  await supabase
    .from('sale_splits')
    .insert({
      sale_id: saleId,
      virtual_account_id: tenantAccount.id, // Using tenant account as reference
      split_type: 'platform',
      gross_amount_cents: platformFeeCents,
      fee_cents: 0,
      net_amount_cents: platformFeeCents,
      percentage: platformFees.percentage,
    });

  console.log(`Processed splits for sale ${saleId}: Tenant=${tenantAmount}, Affiliate=${affiliateSplitCents}, Platform=${platformFeeCents}`);
}
