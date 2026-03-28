/**
 * Split Engine v4.1 - Cost-center based payment split processing
 * 
 * MODEL (v4.1):
 * 1. Interest → pagarme (installment interest = total - subtotal)
 * 2. Platform Fee → Morphews platform account (4.99% + R$1.00 on subtotal)
 * 3. Tax → imposto (12% of subtotal)
 * 4. Shipping + Picking → correio (real shipping + R$7.00 picking)
 * 5. Product Cost → farmacia (cost_cents × qty per item)
 * 6. Affiliate → commission on sales (if attribution exists)
 * 7. Affiliate Manager → % on remaining (if storefront has one configured)
 * 8. Coproducer → % of NET PROFIT (after all costs above)
 * 9. Tenant → remainder
 * 
 * Net Profit = subtotal - platform - tax - shipping - product_cost - affiliate - affiliate_manager
 * Coproducer = commission_percentage% of Net Profit
 * Tenant = Net Profit - Coproducer
 * 
 * IDEMPOTENCY:
 * - virtual_transactions has UNIQUE index on (virtual_account_id, reference_id, transaction_type)
 * - We INSERT transaction FIRST, then split (if tx fails = already processed)
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyAllPartnersForSale } from "./partner-notifications.ts";

// =====================================================
// TYPES
// =====================================================

interface SplitRules {
  platform_fee_percent: number;
  platform_fee_fixed_cents: number;
  default_affiliate_percent: number;
  hold_days_tenant: number;
  hold_days_affiliate: number;
  hold_days_platform: number;
  hold_days_industry: number;
  hold_days_factory: number;
  allow_negative_balance: boolean;
  chargeback_debit_strategy: 'tenant_first' | 'affiliate_first' | 'proportional';
}

interface ReconciliationData {
  transactionId: string;
  feeCents: number;
  netAmountCents: number;
  grossAmountCents: number;
  settlementDate: string | null;
  paidAt: string | null;
  paymentMethod: string;
  installments: number;
}

interface SplitResult {
  factory_amount: number;
  industry_amount: number;
  coproducer_amount: number;
  affiliate_amount: number;
  tenant_amount: number;
  platform_amount: number;
  gateway_fee: number;
}

interface PartnerToNotify {
  type: 'affiliate' | 'coproducer' | 'industry' | 'factory';
  name: string;
  email?: string;
  phone?: string;
  commissionCents: number;
}

// Cost center account IDs (SoVida org - hardcoded for performance)
const COST_ACCOUNTS = {
  pagarme: 'a0000001-0000-0000-0000-000000000001',
  correio: 'a0000001-0000-0000-0000-000000000002',
  farmacia: 'a0000001-0000-0000-0000-000000000003',
  imposto: 'a0000001-0000-0000-0000-000000000004',
};

const PICKING_FEE_CENTS = 700; // R$ 7.00
const TAX_PERCENT = 12; // 12% tax on subtotal

// =====================================================
// HELPERS
// =====================================================

export function buildReferenceId(gateway: string, payload: Record<string, unknown>): string {
  const tx = (payload.transaction || payload) as Record<string, unknown>;
  const txId = tx?.id || tx?.transaction_id || payload?.id || 
               (payload?.charge as Record<string, unknown>)?.id || 'unknown';
  const rawStatus = tx?.status || payload?.current_status || payload?.event || payload?.status || 'unknown';
  return `${gateway}:${txId}:${rawStatus}`;
}

export function isUniqueViolation(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || '');
  const code = String((error as { code?: string })?.code || '');
  return msg.includes('duplicate key') || 
         msg.includes('ux_virtual_tx_idempotency') ||
         msg.includes('unique constraint') ||
         code === '23505';
}

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

async function tryAcquireEventLock(
  supabase: SupabaseClient, 
  referenceId: string, 
  platformAccountId: string,
  saleId: string
): Promise<'acquired' | 'already_processed' | 'needs_recovery'> {
  const lockReferenceId = `${referenceId}::LOCK`;
  
  try {
    const { error } = await supabase
      .from('virtual_transactions')
      .insert({
        virtual_account_id: platformAccountId,
        sale_id: saleId,
        transaction_type: 'credit',
        amount_cents: 0,
        fee_cents: 0,
        net_amount_cents: 0,
        description: `Event lock: ${referenceId}`,
        status: 'completed',
        release_at: new Date().toISOString(),
        reference_id: lockReferenceId,
      });

    if (error) {
      if (isUniqueViolation(error)) {
        const { data: tenantSplit } = await supabase
          .from('sale_splits')
          .select('id')
          .eq('sale_id', saleId)
          .eq('split_type', 'tenant')
          .maybeSingle();

        if (tenantSplit) {
          console.log(`[SplitEngine] Event ${referenceId} fully processed`);
          return 'already_processed';
        } else {
          console.log(`[SplitEngine] Event ${referenceId} has lock but no tenant - RECOVERY MODE`);
          return 'needs_recovery';
        }
      }
      throw error;
    }

    console.log(`[SplitEngine] Acquired lock for event ${referenceId}`);
    return 'acquired';
  } catch (error) {
    if (isUniqueViolation(error)) {
      const { data: tenantSplit } = await supabase
        .from('sale_splits')
        .select('id')
        .eq('sale_id', saleId)
        .eq('split_type', 'tenant')
        .maybeSingle();
      return tenantSplit ? 'already_processed' : 'needs_recovery';
    }
    throw error;
  }
}

// =====================================================
// SPLIT RULES LOADER
// =====================================================

async function loadSplitRules(supabase: SupabaseClient, organizationId: string): Promise<SplitRules> {
  const { data: orgRules } = await supabase
    .from('organization_split_rules')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (orgRules) return orgRules as SplitRules;

  const { data: platformSettings } = await supabase
    .from('platform_settings')
    .select('setting_key, setting_value');

  const settings = (platformSettings || []).reduce((acc: Record<string, unknown>, s: Record<string, unknown>) => {
    acc[s.setting_key as string] = s.setting_value;
    return acc;
  }, {} as Record<string, unknown>);

  const platformFees = (settings.platform_fees || { percentage: 4.99, fixed_cents: 100 }) as Record<string, number>;
  const withdrawalRules = (settings.withdrawal_rules || { release_days: 14 }) as Record<string, number>;

  return {
    platform_fee_percent: platformFees.percentage || 4.99,
    platform_fee_fixed_cents: platformFees.fixed_cents || 100,
    default_affiliate_percent: 10,
    hold_days_tenant: withdrawalRules.release_days || 7,
    hold_days_affiliate: 15,
    hold_days_platform: 0,
    hold_days_industry: 0,
    hold_days_factory: 0,
    allow_negative_balance: true,
    chargeback_debit_strategy: 'proportional',
  };
}

// =====================================================
// ACCOUNT HELPERS
// =====================================================

async function getOrCreateTenantAccount(
  supabase: SupabaseClient, 
  organizationId: string
): Promise<{ id: string; pending_balance_cents: number; total_received_cents: number }> {
  let { data: account } = await supabase
    .from('virtual_accounts')
    .select('id, pending_balance_cents, total_received_cents')
    .eq('organization_id', organizationId)
    .eq('account_type', 'tenant')
    .maybeSingle();

  if (!account) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name, owner_email')
      .eq('id', organizationId)
      .single();

    const orgData = org as Record<string, unknown> | null;
    
    const { data: newAccount } = await supabase
      .from('virtual_accounts')
      .insert({
        organization_id: organizationId,
        account_type: 'tenant',
        holder_name: (orgData?.name as string) || 'Tenant',
        holder_email: (orgData?.owner_email as string) || 'noreply@atomic.ia.br',
        balance_cents: 0,
        pending_balance_cents: 0,
        total_received_cents: 0,
        total_withdrawn_cents: 0,
      })
      .select('id, pending_balance_cents, total_received_cents')
      .single();

    account = newAccount;
  }

  return account || { id: '', pending_balance_cents: 0, total_received_cents: 0 };
}

async function getPlatformAccount(supabase: SupabaseClient): Promise<string> {
  const { data: platformAccount } = await supabase
    .from('virtual_accounts')
    .select('id')
    .eq('account_type', 'platform')
    .maybeSingle();

  return platformAccount?.id || '00000000-0000-0000-0000-000000000001';
}

/**
 * Get or find cost center accounts for the organization.
 * Falls back to hardcoded SoVida IDs, but also looks up by holder_email for other orgs.
 */
async function getCostCenterAccounts(
  supabase: SupabaseClient,
  organizationId: string
): Promise<typeof COST_ACCOUNTS> {
  // For SoVida, use hardcoded IDs for performance
  if (organizationId === '650b1667-e345-498e-9d41-b963faf824a7') {
    return COST_ACCOUNTS;
  }

  // For other orgs, look up by holder_email
  const emails = ['pagarme@sonatura.com.br', 'correio@sonatura.com.br', 'farmacia@sonatura.com.br', 'imposto@sonatura.com.br'];
  const { data: accounts } = await supabase
    .from('virtual_accounts')
    .select('id, holder_email')
    .eq('organization_id', organizationId)
    .eq('account_type', 'cost_center')
    .in('holder_email', emails);

  const result = { ...COST_ACCOUNTS };
  if (accounts) {
    for (const acc of accounts) {
      if (acc.holder_email?.includes('pagarme')) result.pagarme = acc.id;
      else if (acc.holder_email?.includes('correio')) result.correio = acc.id;
      else if (acc.holder_email?.includes('farmacia')) result.farmacia = acc.id;
      else if (acc.holder_email?.includes('imposto')) result.imposto = acc.id;
    }
  }
  return result;
}

// =====================================================
// IDEMPOTENT SPLIT INSERTION
// =====================================================

interface InsertSplitParams {
  supabase: SupabaseClient;
  saleId: string;
  organizationId: string;
  virtualAccountId: string;
  splitType: string;
  amountCents: number;
  feeCents?: number;
  percentage?: number;
  priority: number;
  liableForRefund: boolean;
  liableForChargeback: boolean;
  releaseAt: string;
  referenceId: string;
  description: string;
  industryId?: string;
  factoryId?: string;
}

async function insertSplitAndTransaction(params: InsertSplitParams): Promise<boolean> {
  const { supabase, saleId, virtualAccountId, splitType, amountCents, 
          feeCents = 0, percentage = 0, priority, liableForRefund, liableForChargeback,
          releaseAt, referenceId, description, industryId, factoryId } = params;

  if (amountCents <= 0) return true;

  const txReferenceId = `${referenceId}:${splitType}`;

  try {
    const { data: txData, error: txError } = await supabase
      .from('virtual_transactions')
      .insert({
        virtual_account_id: virtualAccountId,
        sale_id: saleId,
        transaction_type: 'credit',
        amount_cents: amountCents,
        fee_cents: feeCents,
        net_amount_cents: amountCents,
        description,
        status: 'pending',
        release_at: releaseAt,
        reference_id: txReferenceId,
      })
      .select('id')
      .single();

    if (txError) {
      if (isUniqueViolation(txError)) {
        console.log(`[SplitEngine] Duplicate transaction for ${splitType}, already processed`);
        return false;
      }
      throw txError;
    }

    const splitData: Record<string, unknown> = {
      sale_id: saleId,
      virtual_account_id: virtualAccountId,
      split_type: splitType,
      gross_amount_cents: amountCents + feeCents,
      fee_cents: feeCents,
      net_amount_cents: amountCents,
      percentage,
      priority,
      liable_for_refund: liableForRefund,
      liable_for_chargeback: liableForChargeback,
      transaction_id: txData?.id,
    };

    if (industryId) splitData.industry_id = industryId;
    if (factoryId) splitData.factory_id = factoryId;

    await supabase.from('sale_splits').insert(splitData);

    const { data: account } = await supabase
      .from('virtual_accounts')
      .select('pending_balance_cents, total_received_cents')
      .eq('id', virtualAccountId)
      .single();

    if (account) {
      await supabase
        .from('virtual_accounts')
        .update({
          pending_balance_cents: (account.pending_balance_cents || 0) + amountCents,
          total_received_cents: (account.total_received_cents || 0) + amountCents,
        })
        .eq('id', virtualAccountId);
    }

    console.log(`[SplitEngine] Created ${splitType} split: R$${(amountCents / 100).toFixed(2)}`);
    return true;

  } catch (error) {
    if (isUniqueViolation(error)) {
      console.log(`[SplitEngine] Duplicate detected for ${splitType}, skipping`);
      return false;
    }
    console.error(`[SplitEngine] Error creating ${splitType} split:`, error);
    throw error;
  }
}

// =====================================================
// MAIN SPLIT PROCESSOR v4
// =====================================================

export async function processSaleSplitsV3(
  supabase: SupabaseClient,
  saleId: string,
  referenceId: string,
  reconciliation?: ReconciliationData
): Promise<SplitResult> {
  console.log(`[SplitEngine v4] Processing splits for sale ${saleId}`);

  const platformAccountId = await getPlatformAccount(supabase);

  const lockResult = await tryAcquireEventLock(supabase, referenceId, platformAccountId, saleId);
  
  if (lockResult === 'already_processed') {
    console.log(`[SplitEngine] Event fully processed, skipping`);
    return { factory_amount: 0, industry_amount: 0, coproducer_amount: 0, affiliate_amount: 0, tenant_amount: 0, platform_amount: 0, gateway_fee: 0 };
  }
  
  if (lockResult === 'needs_recovery') {
    console.log(`[SplitEngine] RECOVERY MODE: continuing to fill missing splits`);
  }

  // Load sale
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('id, organization_id, total_cents, subtotal_cents, shipping_cost_cents, shipping_cost_real_cents')
    .eq('id', saleId)
    .single();

  if (saleError || !sale) {
    console.error('[SplitEngine] Error loading sale:', saleError);
    throw new Error('Sale not found');
  }

  // Load sale items
  let { data: saleItems } = await supabase
    .from('sale_items')
    .select('product_id, quantity, unit_price_cents, total_cents')
    .eq('sale_id', saleId);

  // Load ecommerce order
  const { data: ecomOrder } = await supabase
    .from('ecommerce_orders')
    .select('id, storefront_id, landing_page_id, source, shipping_cents')
    .eq('sale_id', saleId)
    .maybeSingle();

  // Fallback to ecommerce_order_items
  if ((!saleItems || saleItems.length === 0) && ecomOrder?.id) {
    const { data: ecomItems } = await supabase
      .from('ecommerce_order_items')
      .select('product_id, quantity, unit_price_cents, total_cents')
      .eq('order_id', ecomOrder.id);
    
    if (ecomItems && ecomItems.length > 0) {
      saleItems = ecomItems;
      console.log(`[SplitEngine] Loaded ${ecomItems.length} items from ecommerce_order_items`);
    }
  }

  const storefrontId = ecomOrder?.storefront_id || null;

  // Load split rules and accounts
  const rules = await loadSplitRules(supabase, sale.organization_id);
  const tenantAccount = await getOrCreateTenantAccount(supabase, sale.organization_id);
  const costAccounts = await getCostCenterAccounts(supabase, sale.organization_id);

  // Base calculations
  const baseCents = sale.subtotal_cents || sale.total_cents;
  const interestCents = Math.max(0, sale.total_cents - baseCents);
  const gatewayFeeCents = reconciliation?.feeCents || 0;

  // Shipping: use real cost if available, otherwise what customer paid
  const shippingRealCents = sale.shipping_cost_real_cents || sale.shipping_cost_cents || ecomOrder?.shipping_cents || 0;
  const shippingPlusPicking = shippingRealCents + PICKING_FEE_CENTS;

  // Product costs: load cost_cents for each item
  let totalProductCostCents = 0;
  if (saleItems && saleItems.length > 0) {
    const productIds = saleItems.map(i => i.product_id);
    const { data: products } = await supabase
      .from('lead_products')
      .select('id, cost_cents')
      .in('id', productIds);

    const costMap = new Map<string, number>();
    if (products) {
      for (const p of products) {
        costMap.set(p.id, p.cost_cents || 0);
      }
    }

    for (const item of saleItems) {
      const unitCost = costMap.get(item.product_id) || 0;
      totalProductCostCents += unitCost * (item.quantity || 1);
    }
  }

  // Tax: 12% of subtotal
  const taxCents = Math.round(baseCents * (TAX_PERCENT / 100));

  // Platform fee
  const platformFeeCents = Math.round(baseCents * (rules.platform_fee_percent / 100)) + (rules.platform_fee_fixed_cents || 0);

  console.log(`[SplitEngine v4] Breakdown:`);
  console.log(`  Total cobrado: R$${(sale.total_cents / 100).toFixed(2)}`);
  console.log(`  Subtotal (base): R$${(baseCents / 100).toFixed(2)}`);
  console.log(`  Juros: R$${(interestCents / 100).toFixed(2)}`);
  console.log(`  Plataforma: R$${(platformFeeCents / 100).toFixed(2)}`);
  console.log(`  Imposto (12%): R$${(taxCents / 100).toFixed(2)}`);
  console.log(`  Frete+Picking: R$${(shippingPlusPicking / 100).toFixed(2)}`);
  console.log(`  Custo produto: R$${(totalProductCostCents / 100).toFixed(2)}`);

  let remaining = baseCents;

  const result: SplitResult = {
    factory_amount: 0,
    industry_amount: 0,
    coproducer_amount: 0,
    affiliate_amount: 0,
    tenant_amount: 0,
    platform_amount: 0,
    gateway_fee: gatewayFeeCents,
  };

  const partnersToNotify: PartnerToNotify[] = [];

  // =====================================================
  // STEP 1: INTEREST → pagarme account
  // Interest is NOT part of remaining (it's extra charge)
  // =====================================================
  if (interestCents > 0) {
    await insertSplitAndTransaction({
      supabase,
      saleId,
      organizationId: sale.organization_id,
      virtualAccountId: costAccounts.pagarme,
      splitType: 'interest',
      amountCents: interestCents,
      priority: 1,
      liableForRefund: false,
      liableForChargeback: false,
      releaseAt: new Date().toISOString(),
      referenceId,
      description: `Juros parcelamento - Venda #${saleId.slice(0, 8)}`,
    });
    console.log(`[SplitEngine] Interest: R$${(interestCents / 100).toFixed(2)} → pagarme`);
  }

  // =====================================================
  // STEP 2: PLATFORM FEE → platform account
  // =====================================================
  const cappedPlatformFee = Math.min(platformFeeCents, remaining);
  if (cappedPlatformFee > 0) {
    const created = await insertSplitAndTransaction({
      supabase,
      saleId,
      organizationId: sale.organization_id,
      virtualAccountId: platformAccountId,
      splitType: 'platform_fee',
      amountCents: cappedPlatformFee,
      percentage: rules.platform_fee_percent,
      priority: 1,
      liableForRefund: false,
      liableForChargeback: false,
      releaseAt: addDays(rules.hold_days_platform),
      referenceId,
      description: `Taxa plataforma (${rules.platform_fee_percent}% + R$${(rules.platform_fee_fixed_cents / 100).toFixed(2)}) - Venda #${saleId.slice(0, 8)}`,
    });
    result.platform_amount = cappedPlatformFee;
    remaining -= cappedPlatformFee;
  }

  // =====================================================
  // STEP 3: TAX (12%) → imposto account
  // =====================================================
  const cappedTax = Math.min(taxCents, remaining);
  if (cappedTax > 0) {
    await insertSplitAndTransaction({
      supabase,
      saleId,
      organizationId: sale.organization_id,
      virtualAccountId: costAccounts.imposto,
      splitType: 'tax',
      amountCents: cappedTax,
      percentage: TAX_PERCENT,
      priority: 2,
      liableForRefund: false,
      liableForChargeback: false,
      releaseAt: new Date().toISOString(),
      referenceId,
      description: `Imposto ${TAX_PERCENT}% - Venda #${saleId.slice(0, 8)}`,
    });
    remaining -= cappedTax;
  }

  // =====================================================
  // STEP 4: SHIPPING + PICKING → correio account
  // Even if customer got free shipping, the real cost is deducted
  // =====================================================
  const cappedShipping = Math.min(shippingPlusPicking, remaining);
  if (cappedShipping > 0) {
    await insertSplitAndTransaction({
      supabase,
      saleId,
      organizationId: sale.organization_id,
      virtualAccountId: costAccounts.correio,
      splitType: 'shipping',
      amountCents: cappedShipping,
      priority: 2,
      liableForRefund: false,
      liableForChargeback: false,
      releaseAt: new Date().toISOString(),
      referenceId,
      description: `Frete R$${(shippingRealCents / 100).toFixed(2)} + Picking R$7,00 - Venda #${saleId.slice(0, 8)}`,
    });
    remaining -= cappedShipping;
  }

  // =====================================================
  // STEP 5: PRODUCT COST → farmacia account
  // =====================================================
  const cappedProductCost = Math.min(totalProductCostCents, remaining);
  if (cappedProductCost > 0) {
    await insertSplitAndTransaction({
      supabase,
      saleId,
      organizationId: sale.organization_id,
      virtualAccountId: costAccounts.farmacia,
      splitType: 'product_cost',
      amountCents: cappedProductCost,
      priority: 2,
      liableForRefund: false,
      liableForChargeback: false,
      releaseAt: new Date().toISOString(),
      referenceId,
      description: `Custo produção - Venda #${saleId.slice(0, 8)}`,
    });
    remaining -= cappedProductCost;
  }

  // =====================================================
  // STEP 6: AFFILIATE (if attribution exists)
  // =====================================================
  const { data: attribution } = await supabase
    .from('affiliate_attributions')
    .select('code_or_ref, attribution_type')
    .eq('sale_id', saleId)
    .maybeSingle();

  let affiliateAmount = 0;

  if (attribution?.code_or_ref) {
    const affiliateCode = attribution.code_or_ref;

    // Try organization_affiliates first
    const { data: orgAffiliate } = await supabase
      .from('organization_affiliates')
      .select('id, email, name, user_id, default_commission_type, default_commission_value')
      .eq('organization_id', sale.organization_id)
      .eq('affiliate_code', affiliateCode)
      .eq('is_active', true)
      .maybeSingle();

    let affiliateProcessed = false;

    if (orgAffiliate?.user_id) {
      const { data: networkMember } = await supabase
        .from('affiliate_network_members')
        .select('id, network_id, commission_type, commission_value')
        .eq('affiliate_id', orgAffiliate.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      let virtualAccountId: string | null = null;
      const { data: vaByUser } = await supabase
        .from('virtual_accounts')
        .select('id')
        .eq('user_id', orgAffiliate.user_id)
        .maybeSingle();

      if (vaByUser) {
        virtualAccountId = vaByUser.id;
      } else {
        const { data: newVA } = await supabase
          .from('virtual_accounts')
          .insert({
            organization_id: sale.organization_id,
            user_id: orgAffiliate.user_id,
            account_type: 'affiliate',
            holder_name: orgAffiliate.name || orgAffiliate.email,
            holder_email: orgAffiliate.email,
          })
          .select('id')
          .single();
        virtualAccountId = newVA?.id || null;
      }

      if (virtualAccountId) {
        const commissionType = networkMember?.commission_type || orgAffiliate.default_commission_type || 'percentage';
        const commissionValue = Number(networkMember?.commission_value || orgAffiliate.default_commission_value) || rules.default_affiliate_percent;

        // Affiliate commission is calculated on REMAINING (net after costs)
        if (commissionType === 'percentage') {
          affiliateAmount = Math.round(remaining * (commissionValue / 100));
        } else {
          affiliateAmount = commissionValue;
        }
        
        affiliateAmount = Math.min(affiliateAmount, remaining);
        
        if (affiliateAmount > 0) {
          const commissionLabel = commissionType === 'percentage' 
            ? `${commissionValue}%` 
            : `R$${(commissionValue / 100).toFixed(2)}`;
          
          const created = await insertSplitAndTransaction({
            supabase,
            saleId,
            organizationId: sale.organization_id,
            virtualAccountId,
            splitType: 'affiliate',
            amountCents: affiliateAmount,
            percentage: commissionType === 'percentage' ? commissionValue : 0,
            priority: 3,
            liableForRefund: true,
            liableForChargeback: true,
            releaseAt: addDays(rules.hold_days_affiliate),
            referenceId,
            description: `Comissão afiliado ${affiliateCode} (${commissionLabel}) - Venda #${saleId.slice(0, 8)}`,
          });

          if (created) {
            result.affiliate_amount = affiliateAmount;
            remaining -= affiliateAmount;
            affiliateProcessed = true;
            
            let affiliatePhone: string | undefined;
            if (orgAffiliate.user_id) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('whatsapp')
                .eq('user_id', orgAffiliate.user_id)
                .maybeSingle();
              affiliatePhone = profile?.whatsapp;
            }
            
            partnersToNotify.push({
              type: 'affiliate',
              name: orgAffiliate.name || orgAffiliate.email || 'Afiliado',
              email: orgAffiliate.email,
              phone: affiliatePhone,
              commissionCents: affiliateAmount,
            });
          }
        }
      }
    }

    // LEGACY: Fallback to partner_associations
    if (!affiliateProcessed) {
      const { data: partner } = await supabase
        .from('partner_associations')
        .select('*, virtual_account:virtual_accounts(*)')
        .eq('organization_id', sale.organization_id)
        .eq('affiliate_code', affiliateCode)
        .eq('is_active', true)
        .maybeSingle();

      if (partner?.virtual_account) {
        const virtualAccount = partner.virtual_account as Record<string, unknown>;
        const commissionType = partner.commission_type || 'percentage';
        const commissionValue = Number(partner.commission_value) || rules.default_affiliate_percent;

        if (commissionType === 'percentage') {
          affiliateAmount = Math.round(remaining * (commissionValue / 100));
        } else {
          affiliateAmount = commissionValue;
        }
        
        affiliateAmount = Math.min(affiliateAmount, remaining);
        
        if (affiliateAmount > 0 && virtualAccount?.id) {
          const commissionLabel = commissionType === 'percentage' 
            ? `${commissionValue}%` 
            : `R$${(commissionValue / 100).toFixed(2)}`;
            
          const created = await insertSplitAndTransaction({
            supabase,
            saleId,
            organizationId: sale.organization_id,
            virtualAccountId: virtualAccount.id as string,
            splitType: 'affiliate',
            amountCents: affiliateAmount,
            percentage: commissionType === 'percentage' ? commissionValue : 0,
            priority: 3,
            liableForRefund: true,
            liableForChargeback: true,
            releaseAt: addDays(rules.hold_days_affiliate),
            referenceId,
            description: `Comissão afiliado ${affiliateCode} (${commissionLabel}) - Venda #${saleId.slice(0, 8)}`,
          });

          if (created) {
            result.affiliate_amount = affiliateAmount;
            remaining -= affiliateAmount;
          }
        }
      }
    }
  }

  // =====================================================
  // STEP 7: COPRODUCER → % of NET PROFIT (remaining after all costs)
  // Net profit = remaining at this point (subtotal - platform - tax - shipping - product_cost - affiliate)
  // Coproducer gets commission_percentage% of this net profit
  // =====================================================
  const netProfitBeforeCoprod = remaining;
  console.log(`[SplitEngine v4] Net profit before coproducer: R$${(netProfitBeforeCoprod / 100).toFixed(2)}`);

  if (saleItems && saleItems.length > 0 && netProfitBeforeCoprod > 0) {
    // Collect all unique coproducers across items
    const productIds = saleItems.map(i => i.product_id);
    const { data: coproducerData } = await supabase
      .from('coproducers')
      .select('*, virtual_account:virtual_accounts(*)')
      .in('product_id', productIds)
      .eq('is_active', true);

    if (coproducerData && coproducerData.length > 0) {
      // Group by virtual_account_id to consolidate (same coproducer across products)
      const coproducerMap = new Map<string, { coprod: typeof coproducerData[0]; totalPercent: number }>();
      
      for (const coprod of coproducerData) {
        const vaId = coprod.virtual_account_id;
        const existing = coproducerMap.get(vaId);
        const pct = Number(coprod.commission_percentage) || 0;
        
        if (existing) {
          // Same coproducer, take highest percentage (they should be the same)
          existing.totalPercent = Math.max(existing.totalPercent, pct);
        } else {
          coproducerMap.set(vaId, { coprod, totalPercent: pct });
        }
      }

      for (const [_vaId, { coprod, totalPercent }] of coproducerMap) {
        const virtualAccount = coprod.virtual_account as Record<string, unknown> | null;
        if (!virtualAccount?.id || totalPercent <= 0) continue;

        let coproducerAmount = Math.round(netProfitBeforeCoprod * (totalPercent / 100));
        coproducerAmount = Math.min(coproducerAmount, remaining);

        if (coproducerAmount > 0) {
          const created = await insertSplitAndTransaction({
            supabase,
            saleId,
            organizationId: sale.organization_id,
            virtualAccountId: virtualAccount.id as string,
            splitType: 'coproducer',
            amountCents: coproducerAmount,
            percentage: totalPercent,
            priority: 3,
            liableForRefund: true,
            liableForChargeback: true,
            releaseAt: addDays(rules.hold_days_affiliate),
            referenceId,
            description: `Coprodução ${totalPercent}% do lucro líquido - Venda #${saleId.slice(0, 8)}`,
          });

          if (created) {
            result.coproducer_amount += coproducerAmount;
            remaining -= coproducerAmount;
            console.log(`[SplitEngine] Coproducer: R$${(coproducerAmount / 100).toFixed(2)} (${totalPercent}% of net profit)`);
            
            const holderEmail = virtualAccount?.holder_email as string | undefined;
            const holderName = virtualAccount?.holder_name as string || 'Co-produtor';
            if (holderEmail) {
              let holderPhone: string | undefined;
              const userId = virtualAccount?.user_id as string | undefined;
              if (userId) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('whatsapp')
                  .eq('user_id', userId)
                  .maybeSingle();
                holderPhone = profile?.whatsapp;
              }
              
              partnersToNotify.push({
                type: 'coproducer',
                name: holderName,
                email: holderEmail,
                phone: holderPhone,
                commissionCents: coproducerAmount,
              });
            }
          }
        }
      }
    }
  }

  // =====================================================
  // STEP 8: TENANT → receives the remainder
  // =====================================================
  const tenantAmount = Math.max(0, remaining - gatewayFeeCents);

  if (tenantAmount > 0) {
    const created = await insertSplitAndTransaction({
      supabase,
      saleId,
      organizationId: sale.organization_id,
      virtualAccountId: tenantAccount.id,
      splitType: 'tenant',
      amountCents: tenantAmount,
      feeCents: gatewayFeeCents,
      priority: 4,
      liableForRefund: true,
      liableForChargeback: true,
      releaseAt: addDays(rules.hold_days_tenant),
      referenceId,
      description: `Lucro líquido - Venda #${saleId.slice(0, 8)} (- gateway R$${(gatewayFeeCents / 100).toFixed(2)})`,
    });

    if (created) {
      result.tenant_amount = tenantAmount;
    }
  }

  // =====================================================
  // STEP 9: GATEWAY FEE RECORD (transparency only)
  // =====================================================
  if (gatewayFeeCents > 0) {
    await supabase
      .from('sale_splits')
      .insert({
        sale_id: saleId,
        virtual_account_id: platformAccountId,
        split_type: 'gateway_fee',
        gross_amount_cents: gatewayFeeCents,
        fee_cents: 0,
        net_amount_cents: gatewayFeeCents,
        percentage: (gatewayFeeCents / baseCents) * 100,
        priority: 5,
        liable_for_refund: false,
        liable_for_chargeback: false,
      });
  }

  console.log(`[SplitEngine v4] Completed splits for sale ${saleId}:`, result);

  // =====================================================
  // STEP 10: NOTIFY PARTNERS
  // =====================================================
  if (partnersToNotify.length > 0) {
    const consolidatedMap = new Map<string, typeof partnersToNotify[0]>();
    for (const p of partnersToNotify) {
      const key = `${p.type}:${p.email || p.phone || p.name}`;
      const existing = consolidatedMap.get(key);
      if (existing) {
        existing.commissionCents += p.commissionCents;
      } else {
        consolidatedMap.set(key, { ...p });
      }
    }
    const consolidatedPartners = Array.from(consolidatedMap.values());
    
    console.log(`[SplitEngine] Notifying ${consolidatedPartners.length} partners`);
    
    notifyAllPartnersForSale(supabase, saleId, consolidatedPartners)
      .then(() => console.log(`[SplitEngine] Notifications completed`))
      .catch((err) => console.error(`[SplitEngine] Notification error:`, err));
  }

  return result;
}

// =====================================================
// REFUND/CHARGEBACK PROCESSOR
// =====================================================

export async function processRefundOrChargeback(
  supabase: SupabaseClient,
  saleId: string,
  referenceId: string,
  kind: 'refund' | 'chargeback'
): Promise<void> {
  console.log(`[SplitEngine] Processing ${kind} for sale ${saleId}`);

  const platformAccountId = await getPlatformAccount(supabase);

  const lockResult = await tryAcquireEventLock(supabase, referenceId, platformAccountId, saleId);
  if (lockResult === 'already_processed') {
    console.log(`[SplitEngine] ${kind} already processed, skipping`);
    return;
  }

  const liableColumn = kind === 'refund' ? 'liable_for_refund' : 'liable_for_chargeback';
  
  const { data: liableSplits } = await supabase
    .from('sale_splits')
    .select('*, virtual_account:virtual_accounts(*)')
    .eq('sale_id', saleId)
    .eq(liableColumn, true);

  if (!liableSplits || liableSplits.length === 0) {
    console.log(`[SplitEngine] No liable splits found for ${kind}`);
    return;
  }

  for (const split of liableSplits) {
    const account = split.virtual_account as Record<string, unknown>;
    if (!account?.id) continue;

    const debitAmount = split.net_amount_cents || split.gross_amount_cents || 0;
    const txReferenceId = `${referenceId}:${kind}:${split.split_type}`;

    try {
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

      const { error: txError } = await supabase
        .from('virtual_transactions')
        .insert({
          virtual_account_id: account.id,
          sale_id: saleId,
          transaction_type: kind,
          amount_cents: -debitAmount,
          fee_cents: 0,
          net_amount_cents: -debitAmount,
          description: `${kind === 'refund' ? 'Reembolso' : 'Chargeback'} - Venda #${saleId.slice(0, 8)}`,
          status: 'completed',
          reference_id: txReferenceId,
        });

      if (txError) {
        if (isUniqueViolation(txError)) {
          console.log(`[SplitEngine] ${kind} already processed for ${split.split_type}`);
          continue;
        }
        throw txError;
      }

      if (debitFromPending) {
        await supabase
          .from('virtual_accounts')
          .update({
            pending_balance_cents: ((account.pending_balance_cents as number) || 0) - debitAmount,
          })
          .eq('id', account.id);
      } else {
        await supabase
          .from('virtual_accounts')
          .update({
            balance_cents: ((account.balance_cents as number) || 0) - debitAmount,
          })
          .eq('id', account.id);
      }

    } catch (error) {
      if (!isUniqueViolation(error)) {
        console.error(`[SplitEngine] Error processing ${kind} for ${split.split_type}:`, error);
      }
    }
  }

  await supabase
    .from('sales')
    .update({
      status: 'cancelled',
      payment_status: kind === 'refund' ? 'refunded' : 'chargedback',
    })
    .eq('id', saleId);

  console.log(`[SplitEngine] Completed ${kind} processing for sale ${saleId}`);
}
