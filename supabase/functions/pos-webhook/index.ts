import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

interface PosTransactionPayload {
  terminal_id?: string;
  serial_number?: string;
  logical_number?: string;
  gateway: 'getnet' | 'pagarme' | 'banrisul' | 'vero' | 'banricompras' | 'stone';
  amount_cents: number;
  nsu?: string;
  authorization_code?: string;
  card_brand?: string;
  card_last_digits?: string;
  installments?: number;
  transaction_type?: 'credit' | 'debit' | 'pix';
  gateway_transaction_id?: string;
  gateway_timestamp?: string;
  fee_cents?: number;
  net_amount_cents?: number;
  raw_payload?: Record<string, unknown>;
}

interface SaleCandidate {
  id: string;
  assigned_delivery_user_id: string | null;
  lead_id: string | null;
  total_amount_cents: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json() as Record<string, unknown>;
    console.log('[pos-webhook] Received payload:', JSON.stringify(body).slice(0, 500));

    const transaction = normalizePayload(body);
    if (!transaction) {
      console.error('[pos-webhook] Could not normalize payload');
      return new Response(
        JSON.stringify({ error: 'Invalid payload format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[pos-webhook] Normalized transaction:', JSON.stringify(transaction));

    // Find the terminal
    const terminalQuery = [];
    if (transaction.terminal_id) terminalQuery.push(`terminal_id.eq.${transaction.terminal_id}`);
    if (transaction.serial_number) terminalQuery.push(`serial_number.eq.${transaction.serial_number}`);
    if (transaction.logical_number) terminalQuery.push(`logical_number.eq.${transaction.logical_number}`);

    let terminal: { id: string; organization_id: string; gateway_type: string; assignment_type: string | null } | null = null;
    
    if (terminalQuery.length > 0) {
      const { data } = await supabase
        .from('pos_terminals')
        .select('id, organization_id, gateway_type, assignment_type')
        .or(terminalQuery.join(','))
        .eq('gateway_type', transaction.gateway)
        .eq('is_active', true)
        .maybeSingle();
      terminal = data;
    }

    // Get current assignment if terminal found
    let matchedUserId: string | null = null;
    if (terminal) {
      const { data: assignment } = await supabase
        .from('pos_terminal_assignments')
        .select('user_id')
        .eq('pos_terminal_id', terminal.id)
        .is('unassigned_at', null)
        .maybeSingle();

      matchedUserId = assignment?.user_id || null;
    }

    const orgId = terminal?.organization_id || getOrgFromSecret(req);
    if (!orgId) {
      console.error('[pos-webhook] No organization_id found');
      return new Response(
        JSON.stringify({ error: 'Terminal not found and no organization context' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the transaction
    const { data: insertedTx, error: insertError } = await supabase
      .from('pos_transactions')
      .insert({
        organization_id: orgId,
        pos_terminal_id: terminal?.id || null,
        gateway_type: transaction.gateway,
        amount_cents: transaction.amount_cents,
        nsu: transaction.nsu || null,
        authorization_code: transaction.authorization_code || null,
        card_brand: transaction.card_brand || null,
        card_last_digits: transaction.card_last_digits || null,
        installments: transaction.installments || 1,
        transaction_type: transaction.transaction_type || 'credit',
        gateway_transaction_id: transaction.gateway_transaction_id || null,
        gateway_timestamp: transaction.gateway_timestamp || null,
        fee_cents: transaction.fee_cents || null,
        net_amount_cents: transaction.net_amount_cents || null,
        raw_payload: transaction.raw_payload || body,
        matched_user_id: matchedUserId,
        match_status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[pos-webhook] Insert error:', insertError);
      throw new Error(insertError.message);
    }

    console.log('[pos-webhook] Transaction inserted:', insertedTx.id);

    // Attempt automatic matching
    const matchResult = await attemptAutoMatch(supabase, {
      id: insertedTx.id,
      amount_cents: insertedTx.amount_cents,
      organization_id: orgId,
    }, matchedUserId);

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: insertedTx.id,
        match_status: matchResult.status,
        matched_sale_id: matchResult.sale_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err as Error;
    console.error('[pos-webhook] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function normalizePayload(body: Record<string, unknown>): PosTransactionPayload | null {
  // Getnet format
  if (body.terminal_id && body.nsu && body.authorization_code) {
    return {
      gateway: 'getnet',
      terminal_id: String(body.terminal_id),
      amount_cents: Number(body.amount) || Number(body.amount_cents) || 0,
      nsu: String(body.nsu),
      authorization_code: String(body.authorization_code),
      card_brand: body.brand as string,
      card_last_digits: body.last_digits as string,
      installments: Number(body.installments) || 1,
      transaction_type: mapTransactionType(body.payment_type as string),
      gateway_transaction_id: body.transaction_id as string,
      gateway_timestamp: body.timestamp as string,
      raw_payload: body,
    };
  }

  // Banrisul/Vero format
  if (body.estabelecimento || body.terminal || body.nsu_rede) {
    return {
      gateway: body.adquirente === 'vero' ? 'vero' : 'banrisul',
      terminal_id: String(body.terminal || body.codigo_terminal || ''),
      serial_number: body.serial as string,
      amount_cents: Math.round((Number(body.valor) || 0) * 100),
      nsu: String(body.nsu_rede || body.nsu || ''),
      authorization_code: String(body.codigo_autorizacao || body.autorizacao || ''),
      card_brand: body.bandeira as string,
      card_last_digits: body.ultimos_digitos as string,
      installments: Number(body.parcelas) || 1,
      transaction_type: mapTransactionType(body.tipo_transacao as string),
      gateway_transaction_id: body.id_transacao as string,
      gateway_timestamp: body.data_hora as string,
      raw_payload: body,
    };
  }

  // Stone/Pagar.me format
  const txData = body.transaction as Record<string, unknown> | undefined;
  const dataField = body.data as Record<string, unknown> | undefined;
  const tx = txData || dataField;
  
  if (tx && (tx.nsu || tx.authorization_code)) {
    return {
      gateway: body.gateway === 'stone' ? 'stone' : 'pagarme',
      terminal_id: String(tx.terminal_serial_number || tx.terminal_id || ''),
      amount_cents: Number(tx.amount) || 0,
      nsu: String(tx.nsu || ''),
      authorization_code: String(tx.authorization_code || tx.acquirer_auth_code || ''),
      card_brand: tx.card_brand as string,
      card_last_digits: tx.last_4_digits as string,
      installments: Number(tx.installments) || 1,
      transaction_type: mapTransactionType(tx.payment_method as string),
      gateway_transaction_id: tx.id as string,
      fee_cents: tx.fees ? Number(tx.fees) : undefined,
      net_amount_cents: tx.net_amount ? Number(tx.net_amount) : undefined,
      raw_payload: body,
    };
  }

  // Generic format (fallback)
  if (body.gateway && body.amount_cents) {
    return {
      gateway: body.gateway as PosTransactionPayload['gateway'],
      terminal_id: body.terminal_id as string,
      serial_number: body.serial_number as string,
      amount_cents: Number(body.amount_cents),
      nsu: body.nsu as string,
      authorization_code: body.authorization_code as string,
      card_brand: body.card_brand as string,
      card_last_digits: body.card_last_digits as string,
      installments: Number(body.installments) || 1,
      transaction_type: (body.transaction_type as PosTransactionPayload['transaction_type']) || 'credit',
      gateway_transaction_id: body.gateway_transaction_id as string,
      raw_payload: body,
    };
  }

  return null;
}

function mapTransactionType(type: string | undefined): 'credit' | 'debit' | 'pix' {
  if (!type) return 'credit';
  const lower = type.toLowerCase();
  if (lower.includes('debit') || lower === 'debito') return 'debit';
  if (lower.includes('pix')) return 'pix';
  return 'credit';
}

function getOrgFromSecret(_req: Request): string {
  return '';
}

async function attemptAutoMatch(
  supabase: SupabaseClient,
  tx: { id: string; amount_cents: number; organization_id: string },
  assignedUserId: string | null
): Promise<{ status: string; sale_id: string | null }> {
  
  const { data, error } = await supabase
    .from('sales')
    .select('id, assigned_delivery_user_id, lead_id, total_amount_cents')
    .eq('organization_id', tx.organization_id)
    .eq('total_amount_cents', tx.amount_cents)
    .in('status', ['pending_expedition', 'shipped'])
    .is('pos_transaction_id', null)
    .order('created_at', { ascending: false })
    .limit(10);

  const candidates = (data || []) as SaleCandidate[];
  
  if (error || !candidates.length) {
    console.log('[pos-webhook] No matching sales found');
    await supabase
      .from('pos_transactions')
      .update({ match_status: 'orphan' })
      .eq('id', tx.id);
    return { status: 'orphan', sale_id: null };
  }

  console.log(`[pos-webhook] Found ${candidates.length} candidates for matching`);

  // Priority 1: Match by Amount + Assigned Motoboy
  if (assignedUserId) {
    const matchByMotoboy = candidates.find(s => s.assigned_delivery_user_id === assignedUserId);
    if (matchByMotoboy) {
      console.log(`[pos-webhook] Matched by motoboy: sale ${matchByMotoboy.id}`);
      await linkTransactionToSale(supabase, tx.id, matchByMotoboy.id);
      return { status: 'matched', sale_id: matchByMotoboy.id };
    }
  }

  // Priority 2: If only one candidate with same amount, auto-match
  if (candidates.length === 1) {
    console.log(`[pos-webhook] Single candidate match: sale ${candidates[0].id}`);
    await linkTransactionToSale(supabase, tx.id, candidates[0].id);
    return { status: 'matched', sale_id: candidates[0].id };
  }

  // Multiple candidates - mark as pending for manual review
  console.log('[pos-webhook] Multiple candidates, leaving as pending');
  return { status: 'pending', sale_id: null };
}

async function linkTransactionToSale(
  supabase: SupabaseClient,
  transactionId: string,
  saleId: string
) {
  await supabase
    .from('pos_transactions')
    .update({
      match_status: 'matched',
      sale_id: saleId,
      matched_at: new Date().toISOString(),
    })
    .eq('id', transactionId);

  await supabase
    .from('sales')
    .update({
      pos_transaction_id: transactionId,
      payment_status: 'paid',
      payment_confirmed_at: new Date().toISOString(),
    })
    .eq('id', saleId);

  console.log(`[pos-webhook] Linked transaction ${transactionId} to sale ${saleId}`);
}
