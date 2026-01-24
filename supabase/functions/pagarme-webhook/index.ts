import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Interface para dados de conciliação extraídos do Pagar.me
interface ReconciliationData {
  transactionId: string;
  nsu: string | null;
  authorizationCode: string | null;
  acquirerName: string | null;
  cardBrand: string | null;
  cardLastDigits: string | null;
  installments: number;
  feeCents: number;
  anticipationFeeCents: number;
  netAmountCents: number;
  grossAmountCents: number;
  settlementDate: string | null;
  paidAt: string | null;
  paymentMethod: string;
}

// Extrai dados de conciliação do payload do Pagar.me
function extractReconciliationData(body: any): ReconciliationData {
  // O Pagar.me pode enviar diferentes estruturas dependendo da versão da API
  const transaction = body.transaction || body.data || body;
  const charge = body.charges?.[0] || body.charge || {};
  const lastTransaction = charge.last_transaction || transaction.last_transaction || {};
  
  // Taxas do gateway
  const gatewayFee = lastTransaction.gateway_fee || transaction.gateway_fee || 0;
  const anticipationFee = lastTransaction.anticipation_fee || transaction.anticipation_fee || 0;
  
  // Dados do adquirente
  const acquirerResponse = lastTransaction.acquirer_response || transaction.acquirer_response || {};
  const nsu = lastTransaction.nsu || transaction.nsu || acquirerResponse.nsu || null;
  const authCode = lastTransaction.authorization_code || transaction.authorization_code || acquirerResponse.authorization_code || null;
  const acquirerName = lastTransaction.acquirer_name || transaction.acquirer || acquirerResponse.acquirer_name || 'pagarme';
  
  // Dados do cartão
  const card = charge.payment_method?.card || transaction.card || {};
  const cardBrand = card.brand || lastTransaction.card_brand || null;
  const cardLastDigits = card.last_four_digits || card.last_digits || null;
  
  // Valores
  const grossAmount = charge.amount || transaction.amount || body.amount || 0;
  const netAmount = grossAmount - gatewayFee - anticipationFee;
  
  // Datas
  const paidAt = charge.paid_at || transaction.paid_at || body.paid_at || null;
  const settlementDate = calculateSettlementDate(body.payment_method || 'credit_card', paidAt);
  
  // Parcelas
  const installments = charge.payment_method?.installments || transaction.installments || 1;
  
  return {
    transactionId: lastTransaction.id || transaction.id || body.id || '',
    nsu,
    authorizationCode: authCode,
    acquirerName,
    cardBrand: cardBrand?.toUpperCase() || null,
    cardLastDigits,
    installments,
    feeCents: gatewayFee,
    anticipationFeeCents: anticipationFee,
    netAmountCents: netAmount,
    grossAmountCents: grossAmount,
    settlementDate,
    paidAt,
    paymentMethod: body.payment_method || lastTransaction.payment_method || 'credit_card',
  };
}

// Calcula data de liquidação baseada no método de pagamento
function calculateSettlementDate(paymentMethod: string, paidAt: string | null): string | null {
  if (!paidAt) return null;
  
  const paidDate = new Date(paidAt);
  let settlementDays = 30; // Default D+30 para cartão
  
  switch (paymentMethod) {
    case 'pix':
      settlementDays = 1; // D+1
      break;
    case 'boleto':
      settlementDays = 1; // D+1
      break;
    case 'credit_card':
    default:
      settlementDays = 30; // D+30 (ou 31 dependendo do arranjo)
      break;
  }
  
  paidDate.setDate(paidDate.getDate() + settlementDays);
  return paidDate.toISOString();
}

// Mapeia bandeira do cartão para o enum do banco
function mapCardBrand(brand: string | null): string | null {
  if (!brand) return null;
  
  const brandMap: Record<string, string> = {
    'VISA': 'visa',
    'MASTERCARD': 'mastercard',
    'MASTER': 'mastercard',
    'ELO': 'elo',
    'AMEX': 'amex',
    'AMERICAN EXPRESS': 'amex',
    'HIPERCARD': 'hipercard',
    'HIPER': 'hiper',
    'DINERS': 'diners',
    'DISCOVER': 'discover',
    'JCB': 'jcb',
  };
  
  return brandMap[brand.toUpperCase()] || brand.toLowerCase();
}

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

    // Extrai dados de conciliação
    const reconciliationData = extractReconciliationData(body);
    console.log("Reconciliation data extracted:", JSON.stringify(reconciliationData));

    // Map Pagarme status to our status
    let newStatus = '';
    let paymentStatus = '';

    switch (current_status) {
      case 'paid':
        newStatus = 'payment_confirmed';
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
        paymentStatus = 'pending';
        break;
      default:
        console.log(`Unknown status: ${current_status}`);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Update sale with reconciliation data
    const updateData: Record<string, unknown> = {
      payment_status: paymentStatus,
      gateway_transaction_id: reconciliationData.transactionId,
      gateway_fee_cents: reconciliationData.feeCents,
      gateway_net_cents: reconciliationData.netAmountCents,
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

    // Log payment attempt with full gateway response
    await supabase
      .from('payment_attempts')
      .insert({
        sale_id: saleId,
        gateway: 'pagarme',
        payment_method: reconciliationData.paymentMethod,
        amount_cents: reconciliationData.grossAmountCents,
        installments: reconciliationData.installments,
        status: paymentStatus === 'paid' ? 'approved' : paymentStatus === 'pending' ? 'pending' : 'refused',
        gateway_transaction_id: reconciliationData.transactionId,
        gateway_response: {
          raw: body,
          reconciliation: {
            nsu: reconciliationData.nsu,
            authorization_code: reconciliationData.authorizationCode,
            acquirer: reconciliationData.acquirerName,
            card_brand: reconciliationData.cardBrand,
            card_last_digits: reconciliationData.cardLastDigits,
            fee_cents: reconciliationData.feeCents,
            anticipation_fee_cents: reconciliationData.anticipationFeeCents,
            net_amount_cents: reconciliationData.netAmountCents,
            settlement_date: reconciliationData.settlementDate,
            paid_at: reconciliationData.paidAt,
          },
        },
      });

    // If paid, create sale installments with reconciliation data
    if (current_status === 'paid') {
      await createSaleInstallmentsWithReconciliation(supabase, saleId, reconciliationData);
      await processSaleSplits(supabase, saleId, reconciliationData);
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

// Cria parcelas da venda com dados de conciliação
async function createSaleInstallmentsWithReconciliation(
  supabase: any, 
  saleId: string, 
  reconciliation: ReconciliationData
) {
  const { data: sale } = await supabase
    .from('sales')
    .select('organization_id, total_cents')
    .eq('id', saleId)
    .single();

  if (!sale) return;

  const installments = reconciliation.installments || 1;
  const amountPerInstallment = Math.floor(reconciliation.grossAmountCents / installments);
  const feePerInstallment = Math.floor(reconciliation.feeCents / installments);
  const netPerInstallment = amountPerInstallment - feePerInstallment;

  const transactionDate = reconciliation.paidAt ? new Date(reconciliation.paidAt) : new Date();
  const cardBrand = mapCardBrand(reconciliation.cardBrand);

  for (let i = 0; i < installments; i++) {
    // Data de vencimento: primeira parcela na data de liquidação, demais +30 dias cada
    const dueDate = new Date(reconciliation.settlementDate || transactionDate);
    dueDate.setDate(dueDate.getDate() + (i * 30));

    // Última parcela pode ter ajuste de centavos
    const isLastInstallment = i === installments - 1;
    const adjustedAmount = isLastInstallment 
      ? reconciliation.grossAmountCents - (amountPerInstallment * (installments - 1))
      : amountPerInstallment;
    const adjustedFee = isLastInstallment
      ? reconciliation.feeCents - (feePerInstallment * (installments - 1))
      : feePerInstallment;
    const adjustedNet = adjustedAmount - adjustedFee;

    await supabase
      .from('sale_installments')
      .insert({
        sale_id: saleId,
        installment_number: i + 1,
        total_installments: installments,
        amount_cents: adjustedAmount,
        fee_cents: adjustedFee,
        fee_percentage: reconciliation.feeCents > 0 
          ? Number(((reconciliation.feeCents / reconciliation.grossAmountCents) * 100).toFixed(2))
          : 0,
        net_amount_cents: adjustedNet,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'confirmed',
        transaction_date: transactionDate.toISOString(),
        nsu_cv: reconciliation.nsu || reconciliation.authorizationCode,
        card_brand: cardBrand,
        transaction_type: reconciliation.paymentMethod === 'credit_card' 
          ? (installments > 1 ? 'credit_installment' : 'credit') 
          : reconciliation.paymentMethod === 'debit_card' ? 'debit' : null,
      });
  }

  console.log(`Created ${installments} installments for sale ${saleId} with reconciliation data`);
}

async function processSaleSplits(supabase: any, saleId: string, reconciliation: ReconciliationData) {
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
  const gatewayFeeCents = reconciliation.feeCents; // Taxa real do gateway
  const platformFeeCents = Math.round(totalCents * (platformFees.percentage / 100)) + (platformFees.fixed_cents || 0);
  
  // Use settlement date from gateway or calculate
  const releaseAt = reconciliation.settlementDate 
    ? new Date(reconciliation.settlementDate)
    : (() => {
        const date = new Date();
        date.setDate(date.getDate() + (withdrawalRules.release_days || 14));
        return date;
      })();

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

  // Calculate tenant amount (desconta taxa do gateway + taxa da plataforma)
  const tenantAmount = totalCents - gatewayFeeCents - platformFeeCents - affiliateSplitCents;

  // Create tenant split record
  await supabase
    .from('sale_splits')
    .insert({
      sale_id: saleId,
      virtual_account_id: tenantAccount.id,
      split_type: 'tenant',
      gross_amount_cents: totalCents - affiliateSplitCents,
      fee_cents: gatewayFeeCents + platformFeeCents,
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
      fee_cents: gatewayFeeCents + platformFeeCents,
      net_amount_cents: tenantAmount,
      description: `Venda #${saleId.slice(0, 8)} (- gateway R$${(gatewayFeeCents/100).toFixed(2)} - plataforma R$${(platformFeeCents/100).toFixed(2)})`,
      status: 'pending',
      release_at: releaseAt.toISOString(),
    });

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

  // Create gateway fee record
  await supabase
    .from('sale_splits')
    .insert({
      sale_id: saleId,
      virtual_account_id: tenantAccount.id,
      split_type: 'gateway',
      gross_amount_cents: gatewayFeeCents,
      fee_cents: 0,
      net_amount_cents: gatewayFeeCents,
      percentage: (gatewayFeeCents / totalCents) * 100,
    });

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
      percentage: platformFees.percentage,
    });

  console.log(`Processed splits for sale ${saleId}: Tenant=${tenantAmount}, Gateway Fee=${gatewayFeeCents}, Platform=${platformFeeCents}, Affiliate=${affiliateSplitCents}`);
}
