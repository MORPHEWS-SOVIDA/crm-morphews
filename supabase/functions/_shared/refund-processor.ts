import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Refund Processor - Shared module for reversing splits
 * 
 * This processes refunds by debiting ALL liable partner accounts:
 * - Affiliates
 * - Coproducers  
 * - Industries
 * - Factories
 * - Tenant
 * 
 * Platform fee is NOT debited (platform keeps fee even on refund)
 */

function isUniqueViolation(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: string }).code === '23505';
  }
  return false;
}

export async function processRefundSplits(
  supabase: SupabaseClient,
  saleId: string,
  referenceId: string,
  kind: 'refund' | 'chargeback' = 'refund'
): Promise<{ success: boolean; debited: number; errors: string[] }> {
  console.log(`[RefundProcessor] Processing ${kind} for sale ${saleId}`);
  
  const errors: string[] = [];
  let debitedCount = 0;

  // Get all liable splits for this sale
  const liableColumn = kind === 'refund' ? 'liable_for_refund' : 'liable_for_chargeback';
  
  const { data: liableSplits, error: splitsError } = await supabase
    .from('sale_splits')
    .select('*, virtual_account:virtual_accounts(*)')
    .eq('sale_id', saleId)
    .eq(liableColumn, true);

  if (splitsError) {
    console.error(`[RefundProcessor] Error fetching splits:`, splitsError);
    return { success: false, debited: 0, errors: [splitsError.message] };
  }

  if (!liableSplits || liableSplits.length === 0) {
    console.log(`[RefundProcessor] No liable splits found for ${kind}`);
    return { success: true, debited: 0, errors: ['No liable splits found'] };
  }

  console.log(`[RefundProcessor] Found ${liableSplits.length} liable splits to process`);

  // Debit each liable account
  for (const split of liableSplits) {
    const account = split.virtual_account as Record<string, unknown>;
    if (!account?.id) {
      errors.push(`No virtual account for split ${split.split_type}`);
      continue;
    }

    const debitAmount = split.net_amount_cents || split.gross_amount_cents || 0;
    if (debitAmount <= 0) {
      console.log(`[RefundProcessor] Skipping ${split.split_type} - zero amount`);
      continue;
    }

    const txReferenceId = `${referenceId}:${kind}:${split.split_type}`;

    try {
      // Find original transaction status to determine which balance to debit
      let originalStatus = 'pending';
      
      if (split.transaction_id) {
        const { data: linkedTx } = await supabase
          .from('virtual_transactions')
          .select('status')
          .eq('id', split.transaction_id)
          .single();
        originalStatus = linkedTx?.status || 'pending';
      } else {
        const { data: originalTx } = await supabase
          .from('virtual_transactions')
          .select('status')
          .eq('sale_id', saleId)
          .eq('virtual_account_id', account.id)
          .eq('transaction_type', 'credit')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        originalStatus = originalTx?.status || 'pending';
      }

      const debitFromPending = originalStatus === 'pending';

      // Create debit transaction (idempotent via reference_id)
      const { error: txError } = await supabase
        .from('virtual_transactions')
        .insert({
          virtual_account_id: account.id,
          sale_id: saleId,
          transaction_type: kind,
          amount_cents: -debitAmount,
          fee_cents: 0,
          net_amount_cents: -debitAmount,
          description: `${kind === 'refund' ? 'Reembolso' : 'Chargeback'} - Venda #${saleId.slice(0, 8)} (${split.split_type})`,
          status: 'completed',
          reference_id: txReferenceId,
        });

      if (txError) {
        if (isUniqueViolation(txError)) {
          console.log(`[RefundProcessor] ${kind} already processed for ${split.split_type}`);
          continue;
        }
        throw txError;
      }

      // Debit from correct balance
      if (debitFromPending) {
        await supabase
          .from('virtual_accounts')
          .update({
            pending_balance_cents: ((account.pending_balance_cents as number) || 0) - debitAmount,
          })
          .eq('id', account.id);
        console.log(`[RefundProcessor] Debited R$${(debitAmount / 100).toFixed(2)} from ${split.split_type} PENDING (${account.holder_name})`);
      } else {
        await supabase
          .from('virtual_accounts')
          .update({
            balance_cents: ((account.balance_cents as number) || 0) - debitAmount,
          })
          .eq('id', account.id);
        console.log(`[RefundProcessor] Debited R$${(debitAmount / 100).toFixed(2)} from ${split.split_type} BALANCE (${account.holder_name})`);
      }

      debitedCount++;

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${split.split_type}: ${errMsg}`);
      console.error(`[RefundProcessor] Error processing ${split.split_type}:`, error);
    }
  }

  // Update sale status
  await supabase
    .from('sales')
    .update({
      status: 'cancelled',
      payment_status: kind === 'refund' ? 'refunded' : 'chargedback',
    })
    .eq('id', saleId);

  console.log(`[RefundProcessor] Completed ${kind} - debited ${debitedCount} accounts`);
  
  return { 
    success: errors.length === 0, 
    debited: debitedCount, 
    errors 
  };
}
