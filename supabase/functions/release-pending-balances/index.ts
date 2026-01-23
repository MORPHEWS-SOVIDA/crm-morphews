import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Scheduled function to release pending balances after the holding period
 * Should be called by a cron job daily
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Find transactions ready to be released
    const { data: pendingTransactions, error: fetchError } = await supabase
      .from('virtual_transactions')
      .select('id, virtual_account_id, net_amount_cents')
      .eq('status', 'pending')
      .lte('release_at', now);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${pendingTransactions?.length || 0} transactions to release`);

    let releasedCount = 0;
    let totalReleasedCents = 0;

    for (const tx of pendingTransactions || []) {
      // Update transaction status
      await supabase
        .from('virtual_transactions')
        .update({
          status: 'released',
          released_at: now,
        })
        .eq('id', tx.id);

      // Update account balances
      const { data: account } = await supabase
        .from('virtual_accounts')
        .select('balance_cents, pending_balance_cents')
        .eq('id', tx.virtual_account_id)
        .single();

      if (account) {
        await supabase
          .from('virtual_accounts')
          .update({
            balance_cents: account.balance_cents + tx.net_amount_cents,
            pending_balance_cents: Math.max(0, account.pending_balance_cents - tx.net_amount_cents),
          })
          .eq('id', tx.virtual_account_id);

        releasedCount++;
        totalReleasedCents += tx.net_amount_cents;
      }
    }

    console.log(`Released ${releasedCount} transactions, total: R$ ${(totalReleasedCents / 100).toFixed(2)}`);

    return new Response(
      JSON.stringify({
        success: true,
        released_count: releasedCount,
        total_released_cents: totalReleasedCents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Release balance error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
