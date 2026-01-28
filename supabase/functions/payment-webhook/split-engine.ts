/**
 * Split Engine v3 - Unified payment split processing
 * 
 * Rules:
 * 1. Factory receives first (priority=1), never debited on refund/chargeback
 * 2. Industry receives immediately (release_at=now), never debited
 * 3. Tenant + Affiliate are the only liable for refund/chargeback
 * 4. Platform fee (Morphews) includes interest profit, never debited
 * 
 * IDEMPOTENCY:
 * - virtual_transactions has UNIQUE index on (virtual_account_id, reference_id, transaction_type)
 * - We INSERT transaction FIRST, then split (if tx fails = already processed)
 * - This prevents orphan splits
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// =====================================================
// HELPERS
// =====================================================

/**
 * Build unique reference ID for idempotency
 * CRITICAL: Reference ID is STABLE by logical event (no timestamp!)
 * This prevents duplicate processing when gateway resends with different timestamps
 */
export function buildReferenceId(gateway: string, payload: Record<string, unknown>): string {
  const tx = (payload.transaction || payload) as Record<string, unknown>;
  
  // Get transaction ID (the most stable identifier)
  const txId = tx?.id || tx?.transaction_id || payload?.id || 
               (payload?.charge as Record<string, unknown>)?.id || 'unknown';
  
  // Get status - normalize to our internal status
  const rawStatus = tx?.status || payload?.current_status || payload?.event || payload?.status || 'unknown';
  
  // DO NOT include timestamp - it varies across retries!
  // Reference format: gateway:transactionId:status
  return `${gateway}:${txId}:${rawStatus}`;
}

/**
 * Check if error is a unique constraint violation (idempotency check)
 */
export function isUniqueViolation(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || '');
  const code = String((error as { code?: string })?.code || '');
  return msg.includes('duplicate key') || 
         msg.includes('ux_virtual_tx_idempotency') ||
         msg.includes('unique constraint') ||
         code === '23505'; // PostgreSQL unique_violation
}

/**
 * Add days to current date and return ISO string
 */
function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Try to acquire event lock via unique transaction
 * Returns: 'acquired' | 'already_processed' | 'needs_recovery'
 */
async function tryAcquireEventLock(
  supabase: SupabaseClient, 
  referenceId: string, 
  platformAccountId: string,
  saleId: string
): Promise<'acquired' | 'already_processed' | 'needs_recovery'> {
  // Use ::LOCK suffix to prevent any collision with split reference IDs
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
        // Lock exists - check if processing completed (tenant split exists)
        const { data: tenantSplit } = await supabase
          .from('sale_splits')
          .select('id')
          .eq('sale_id', saleId)
          .eq('split_type', 'tenant')
          .maybeSingle();

        if (tenantSplit) {
          console.log(`[SplitEngine] Event ${referenceId} fully processed (lock + tenant exist)`);
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
      // Double-check recovery mode
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
  // Try organization-specific rules first
  const { data: orgRules } = await supabase
    .from('organization_split_rules')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (orgRules) {
    return orgRules as SplitRules;
  }

  // Fall back to platform_settings
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
    // Fetch org data for account creation
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
        holder_email: (orgData?.owner_email as string) || 'noreply@morphews.com',
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

  // Use the singleton platform account or return a fixed ID
  return platformAccount?.id || '00000000-0000-0000-0000-000000000001';
}

// =====================================================
// IDEMPOTENT SPLIT INSERTION
// Order: Transaction FIRST, then Split (prevents orphan splits)
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
    // STEP 1: Insert virtual transaction FIRST (idempotency lock)
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
        return false; // Already processed - DO NOT create split
      }
      throw txError;
    }

    // STEP 2: Insert split record (only if transaction succeeded)
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
      transaction_id: txData?.id, // Link to transaction
    };

    if (industryId) splitData.industry_id = industryId;
    if (factoryId) splitData.factory_id = factoryId;

    await supabase.from('sale_splits').insert(splitData);

    // STEP 3: Update virtual account balances
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
// MAIN SPLIT PROCESSOR
// =====================================================

export async function processSaleSplitsV3(
  supabase: SupabaseClient,
  saleId: string,
  referenceId: string,
  reconciliation?: ReconciliationData
): Promise<SplitResult> {
  console.log(`[SplitEngine] Processing splits for sale ${saleId} with referenceId ${referenceId}`);

  // Get platform account for locking
  const platformAccountId = await getPlatformAccount(supabase);

  // CRITICAL: Acquire event lock FIRST (all-or-nothing per event)
  // Returns: 'acquired' | 'already_processed' | 'needs_recovery'
  const lockResult = await tryAcquireEventLock(supabase, referenceId, platformAccountId, saleId);
  
  if (lockResult === 'already_processed') {
    console.log(`[SplitEngine] Event fully processed, skipping`);
    return { factory_amount: 0, industry_amount: 0, coproducer_amount: 0, affiliate_amount: 0, tenant_amount: 0, platform_amount: 0, gateway_fee: 0 };
  }
  
  if (lockResult === 'needs_recovery') {
    console.log(`[SplitEngine] RECOVERY MODE: Lock exists but incomplete, continuing to fill missing splits`);
    // Continue processing - individual splits have their own idempotency via reference_id
  }
  
  // 'acquired' or 'needs_recovery' - proceed with processing

  // 2) Load sale with items
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('id, organization_id, total_cents')
    .eq('id', saleId)
    .single();

  if (saleError || !sale) {
    console.error('[SplitEngine] Error loading sale:', saleError);
    throw new Error('Sale not found');
  }

  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('product_id, quantity, unit_price_cents, total_cents')
    .eq('sale_id', saleId);

  // 2b) Load ecommerce_order to get storefront_id/landing_page_id for partner processing
  const { data: ecomOrder } = await supabase
    .from('ecommerce_orders')
    .select('storefront_id, landing_page_id, source')
    .eq('sale_id', saleId)
    .maybeSingle();

  const storefrontId = ecomOrder?.storefront_id || null;
  const landingPageId = ecomOrder?.landing_page_id || null;
  console.log(`[SplitEngine] Source: ${ecomOrder?.source || 'unknown'}, storefront: ${storefrontId}, landing: ${landingPageId}`);

  // 3) Load split rules
  const rules = await loadSplitRules(supabase, sale.organization_id);
  
  // 4) Get tenant account (platform account already fetched above for lock)
  const tenantAccount = await getOrCreateTenantAccount(supabase, sale.organization_id);

  const totalCents = sale.total_cents;
  const gatewayFeeCents = reconciliation?.feeCents || 0;
  let remaining = totalCents;

  const result: SplitResult = {
    factory_amount: 0,
    industry_amount: 0,
    coproducer_amount: 0,
    affiliate_amount: 0,
    tenant_amount: 0,
    platform_amount: 0,
    gateway_fee: gatewayFeeCents,
  };

  // =====================================================
  // STEP A: FACTORY (priority=1, first to receive, never liable)
  // =====================================================
  if (saleItems && saleItems.length > 0) {
    for (const item of saleItems) {
      const { data: factoryCosts } = await supabase
        .from('product_factory_costs')
        .select('*, factory:factories(*)')
        .eq('product_id', item.product_id)
        .eq('is_active', true);

      if (factoryCosts && factoryCosts.length > 0) {
        for (const cost of factoryCosts) {
          // Calculate factory amount (can be % or fixed)
          let factoryAmount = 0;
          
          // Percentage fee
          if (cost.factory_fee_percent > 0) {
            factoryAmount = Math.round(item.total_cents * (Number(cost.factory_fee_percent) / 100));
          }
          
          // Fixed fee per unit
          factoryAmount += (cost.factory_fee_fixed_cents || 0) * (item.quantity || 1);
          
          // Unit costs (product cost + shipping + additional)
          const unitCosts = ((cost.unit_cost_cents || 0) + (cost.shipping_cost_cents || 0) + (cost.additional_cost_cents || 0)) * (item.quantity || 1);
          factoryAmount += unitCosts;

          // CAP: Never exceed remaining amount
          factoryAmount = Math.min(factoryAmount, remaining);

          if (factoryAmount > 0) {
            const factory = cost.factory as Record<string, unknown> | null;
            const factoryAccountId = (factory?.virtual_account_id as string) || tenantAccount.id;

            const created = await insertSplitAndTransaction({
              supabase,
              saleId,
              organizationId: sale.organization_id,
              virtualAccountId: factoryAccountId,
              splitType: 'factory',
              amountCents: factoryAmount,
              priority: 1,
              liableForRefund: false,
              liableForChargeback: false,
              releaseAt: addDays(rules.hold_days_factory),
              referenceId,
              description: `Fábrica ${factory?.name || 'N/A'} - Venda #${saleId.slice(0, 8)}`,
              factoryId: cost.factory_id,
            });

            if (created) {
              result.factory_amount += factoryAmount;
              remaining -= factoryAmount;
            }
          }
        }
      }
    }
  }

  // =====================================================
  // STEP B: INDUSTRY (immediate release, never liable)
  // =====================================================
  if (saleItems && saleItems.length > 0) {
    for (const item of saleItems) {
      const { data: industryCosts } = await supabase
        .from('product_industry_costs')
        .select('*, industry:industries(*)')
        .eq('product_id', item.product_id)
        .eq('is_active', true);

      if (industryCosts && industryCosts.length > 0) {
        for (const cost of industryCosts) {
          const unitTotal = ((cost.unit_cost_cents || 0) + (cost.shipping_cost_cents || 0) + (cost.additional_cost_cents || 0));
          let industryAmount = unitTotal * (item.quantity || 1);

          // CAP: Never exceed remaining amount
          industryAmount = Math.min(industryAmount, remaining);

          if (industryAmount > 0) {
            const industry = cost.industry as Record<string, unknown> | null;
            const industryAccountId = (industry?.virtual_account_id as string) || tenantAccount.id;

            const created = await insertSplitAndTransaction({
              supabase,
              saleId,
              organizationId: sale.organization_id,
              virtualAccountId: industryAccountId,
              splitType: 'industry',
              amountCents: industryAmount,
              priority: 2,
              liableForRefund: false,
              liableForChargeback: false,
              releaseAt: new Date().toISOString(), // Immediate release (à vista)
              referenceId,
              description: `Indústria ${industry?.name || 'N/A'} - Venda #${saleId.slice(0, 8)}`,
              industryId: cost.industry_id,
            });

            if (created) {
              result.industry_amount += industryAmount;
              remaining -= industryAmount;
            }
          }
        }
      }
    }
  }

  // =====================================================
  // STEP C: PLATFORM FEE (never liable)
  // =====================================================
  let platformFeeCents = Math.round(totalCents * (rules.platform_fee_percent / 100)) + (rules.platform_fee_fixed_cents || 0);
  
  // CAP: Never exceed remaining amount
  platformFeeCents = Math.min(platformFeeCents, remaining);
  
  if (platformFeeCents > 0) {
    const created = await insertSplitAndTransaction({
      supabase,
      saleId,
      organizationId: sale.organization_id,
      virtualAccountId: platformAccountId,
      splitType: 'platform_fee',
      amountCents: platformFeeCents,
      percentage: rules.platform_fee_percent,
      priority: 2,
      liableForRefund: false,
      liableForChargeback: false,
      releaseAt: addDays(rules.hold_days_platform),
      referenceId,
      description: `Taxa plataforma - Venda #${saleId.slice(0, 8)}`,
    });

    if (created) {
      result.platform_amount = platformFeeCents;
      remaining -= platformFeeCents;
    }
  }

  // Calculate base for affiliate commission = totalCents - platformFeeCents
  // This ensures affiliate gets commission on (sale value - platform fee) only
  // NOT affected by factory/industry deductions
  const baseForAffiliateCommission = totalCents - result.platform_amount;

  // =====================================================
  // STEP C.5: COPRODUCERS (liable for refund/chargeback like affiliate)
  // Based on product-level coproducer assignments
  // =====================================================
  if (saleItems && saleItems.length > 0) {
    for (const item of saleItems) {
      const { data: coproducerData } = await supabase
        .from('coproducers')
        .select('*, virtual_account:virtual_accounts(*)')
        .eq('product_id', item.product_id)
        .eq('is_active', true);

      if (coproducerData && coproducerData.length > 0) {
        for (const coprod of coproducerData) {
          const commissionPercent = Number(coprod.commission_percentage) || 0;
          // Calculate coproducer amount based on the item total
          let coproducerAmount = Math.round(item.total_cents * (commissionPercent / 100));
          
          // CAP: Never exceed remaining amount
          coproducerAmount = Math.min(coproducerAmount, remaining);
          
          const virtualAccount = coprod.virtual_account as Record<string, unknown> | null;

          if (coproducerAmount > 0 && virtualAccount?.id) {
            const created = await insertSplitAndTransaction({
              supabase,
              saleId,
              organizationId: sale.organization_id,
              virtualAccountId: virtualAccount.id as string,
              splitType: 'coproducer',
              amountCents: coproducerAmount,
              percentage: commissionPercent,
              priority: 2,
              liableForRefund: true,
              liableForChargeback: true,
              releaseAt: addDays(rules.hold_days_affiliate), // Same hold as affiliate
              referenceId,
              description: `Coprodução ${commissionPercent}% - Produto ${item.product_id.slice(0, 8)} - Venda #${saleId.slice(0, 8)}`,
            });

            if (created) {
              result.coproducer_amount += coproducerAmount;
              remaining -= coproducerAmount;
              console.log(`[SplitEngine] Coproducer split: R$${(coproducerAmount / 100).toFixed(2)} (${commissionPercent}%)`);
            }
          }
        }
      }
    }
  }

  // =====================================================
  // STEP C.6: STOREFRONT-LINKED PARTNERS (Industry/Factory/Coproducer)
  // Partners manually assigned to this specific storefront via AffiliatesTab
  // =====================================================
  if (storefrontId) {
    // Fetch all partners linked to this storefront
    const { data: storefrontPartners } = await supabase
      .from('partner_associations')
      .select('*, virtual_account:virtual_accounts(*)')
      .eq('linked_storefront_id', storefrontId)
      .eq('is_active', true);

    if (storefrontPartners && storefrontPartners.length > 0) {
      const processedVirtualAccountIds = new Set<string>(); // Avoid duplicates

      for (const partner of storefrontPartners) {
        const virtualAccount = partner.virtual_account as Record<string, unknown> | null;
        if (!virtualAccount?.id) continue;

        // Skip if already processed (same virtual account)
        if (processedVirtualAccountIds.has(virtualAccount.id as string)) continue;
        processedVirtualAccountIds.add(virtualAccount.id as string);

        const commissionType = partner.commission_type || 'percentage';
        const commissionValue = Number(partner.commission_value) || 0;
        const partnerType = partner.partner_type || 'affiliate';
        const liableForRefund = partner.responsible_for_refunds ?? (partnerType === 'affiliate' || partnerType === 'coproducer');
        const liableForChargeback = partner.responsible_for_chargebacks ?? (partnerType === 'affiliate' || partnerType === 'coproducer');

        // Calculate amount
        // For affiliates/coproducers: use baseForAffiliateCommission (total - platform_fee)
        // For factory/industry: use totalCents (they get their cut before platform fee)
        let partnerAmount = 0;
        const useAffiliateBase = partnerType === 'affiliate' || partnerType === 'coproducer';
        const baseAmount = useAffiliateBase ? baseForAffiliateCommission : totalCents;
        
        if (commissionType === 'percentage') {
          partnerAmount = Math.round(baseAmount * (commissionValue / 100));
        } else {
          // Fixed commission per sale
          partnerAmount = commissionValue;
        }

        // For industry/factory types with per-unit logic, multiply by total items
        if ((partnerType === 'industry' || partnerType === 'factory') && commissionType === 'fixed' && saleItems) {
          const totalUnits = saleItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
          partnerAmount = commissionValue * totalUnits;
        }

        // CAP: Never exceed remaining
        partnerAmount = Math.min(partnerAmount, remaining);

        if (partnerAmount > 0) {
          // Determine split type based on partner type
          let splitType = 'affiliate';
          let releaseAt = addDays(rules.hold_days_affiliate);

          if (partnerType === 'factory') {
            splitType = 'factory';
            releaseAt = addDays(rules.hold_days_factory);
          } else if (partnerType === 'industry') {
            splitType = 'industry';
            releaseAt = new Date().toISOString(); // Immediate
          } else if (partnerType === 'coproducer') {
            splitType = 'coproducer';
          }

          const commissionLabel = commissionType === 'percentage'
            ? `${commissionValue}%`
            : `R$${(commissionValue / 100).toFixed(2)}`;

          const created = await insertSplitAndTransaction({
            supabase,
            saleId,
            organizationId: sale.organization_id,
            virtualAccountId: virtualAccount.id as string,
            splitType,
            amountCents: partnerAmount,
            percentage: commissionType === 'percentage' ? commissionValue : 0,
            priority: partnerType === 'factory' ? 1 : 2,
            liableForRefund,
            liableForChargeback,
            releaseAt,
            referenceId,
            description: `${partnerType.charAt(0).toUpperCase() + partnerType.slice(1)} (storefront) ${partner.affiliate_code || 'N/A'} (${commissionLabel}) - Venda #${saleId.slice(0, 8)}`,
          });

          if (created) {
            // Aggregate into result
            if (partnerType === 'factory') result.factory_amount += partnerAmount;
            else if (partnerType === 'industry') result.industry_amount += partnerAmount;
            else if (partnerType === 'coproducer') result.coproducer_amount += partnerAmount;
            else result.affiliate_amount += partnerAmount;

            remaining -= partnerAmount;
            console.log(`[SplitEngine] Storefront partner (${partnerType}): R$${(partnerAmount / 100).toFixed(2)} (${commissionLabel})`);
          }
        }
      }
    }
  }

  // AFFILIATE SPLIT: Via affiliate_networks OR partner_associations (legacy)
  // =====================================================
  const { data: attribution } = await supabase
    .from('affiliate_attributions')
    .select('code_or_ref, attribution_type')
    .eq('sale_id', saleId)
    .maybeSingle();

  let affiliateAmount = 0;

  if (attribution?.code_or_ref) {
    const affiliateCode = attribution.code_or_ref;

    // NEW: First try to find affiliate via organization_affiliates + affiliate_network_members
    const { data: orgAffiliate } = await supabase
      .from('organization_affiliates')
      .select('id, email, name, user_id, default_commission_type, default_commission_value')
      .eq('organization_id', sale.organization_id)
      .eq('affiliate_code', affiliateCode)
      .eq('is_active', true)
      .maybeSingle();

    let affiliateProcessed = false;

    if (orgAffiliate) {
      // Check if this affiliate is part of a network
      const { data: networkMember } = await supabase
        .from('affiliate_network_members')
        .select('id, network_id, commission_type, commission_value')
        .eq('affiliate_id', orgAffiliate.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (networkMember && orgAffiliate.user_id) {
        // Get or create virtual account for this affiliate
        let virtualAccountId: string | null = null;

        const { data: vaByUser } = await supabase
          .from('virtual_accounts')
          .select('id')
          .eq('user_id', orgAffiliate.user_id)
          .maybeSingle();

        if (vaByUser) {
          virtualAccountId = vaByUser.id;
        } else {
          // Create virtual account for this affiliate user
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
          const commissionType = networkMember.commission_type || 'percentage';
          const commissionValue = Number(networkMember.commission_value) || rules.default_affiliate_percent;

          // Calculate commission based on type
          // IMPORTANT: Calculate on (total - platform_fee), not on remaining
          // This ensures affiliate gets their % on net sale value
          if (commissionType === 'percentage') {
            affiliateAmount = Math.round(baseForAffiliateCommission * (commissionValue / 100));
          } else {
            // Fixed commission - value is in cents, applied per sale
            affiliateAmount = commissionValue;
          }
          
          // CAP: Never exceed remaining amount
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
              priority: 2,
              liableForRefund: true, // Network affiliates are liable
              liableForChargeback: true,
              releaseAt: addDays(rules.hold_days_affiliate),
              referenceId,
              description: `Comissão afiliado ${affiliateCode} (${commissionLabel}) - Venda #${saleId.slice(0, 8)}`,
            });

            if (created) {
              result.affiliate_amount = affiliateAmount;
              remaining -= affiliateAmount;
              console.log(`[SplitEngine] Network affiliate split: R$${(affiliateAmount / 100).toFixed(2)} (${commissionLabel})`);
              affiliateProcessed = true;
            }
          }
        }
      }
    }

    // LEGACY: Fallback to partner_associations if not found via networks
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
        const liableForRefund = partner.responsible_for_refunds ?? true;
        const liableForChargeback = partner.responsible_for_chargebacks ?? true;

        // Calculate commission based on type
        // IMPORTANT: Calculate on (total - platform_fee), not on remaining
        if (commissionType === 'percentage') {
          affiliateAmount = Math.round(baseForAffiliateCommission * (commissionValue / 100));
        } else {
          // Fixed commission - value is in cents, applied per sale
          affiliateAmount = commissionValue;
        }
        
        // CAP: Never exceed remaining amount
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
            priority: 2,
            liableForRefund,
            liableForChargeback,
            releaseAt: addDays(rules.hold_days_affiliate),
            referenceId,
            description: `Comissão ${partner.partner_type || 'afiliado'} ${partner.affiliate_code || 'N/A'} (${commissionLabel}) - Venda #${saleId.slice(0, 8)}`,
          });

          if (created) {
            result.affiliate_amount = affiliateAmount;
            remaining -= affiliateAmount;
            console.log(`[SplitEngine] Partner split (${partner.partner_type}): R$${(affiliateAmount / 100).toFixed(2)} (${commissionLabel})`);
          }
        }
      }
    }
  }

  // =====================================================
  // STEP E: TENANT (receives the rest, liable for refund/chargeback)
  // =====================================================
  // Deduct gateway fee from tenant's share
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
      priority: 2,
      liableForRefund: true,
      liableForChargeback: true,
      releaseAt: addDays(rules.hold_days_tenant),
      referenceId,
      description: `Venda #${saleId.slice(0, 8)} (- gateway R$${(gatewayFeeCents / 100).toFixed(2)})`,
    });

    if (created) {
      result.tenant_amount = tenantAmount;
    }
  }

  // =====================================================
  // STEP F: GATEWAY FEE RECORD (for transparency, no transaction)
  // =====================================================
  if (gatewayFeeCents > 0) {
    // Just record the split, no virtual transaction (money goes to gateway, not internal account)
    await supabase
      .from('sale_splits')
      .insert({
        sale_id: saleId,
        virtual_account_id: platformAccountId,
        split_type: 'gateway_fee',
        gross_amount_cents: gatewayFeeCents,
        fee_cents: 0,
        net_amount_cents: gatewayFeeCents,
        percentage: (gatewayFeeCents / totalCents) * 100,
        priority: 2,
        liable_for_refund: false,
        liable_for_chargeback: false,
      });
  }

  console.log(`[SplitEngine] Completed splits for sale ${saleId}:`, result);
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

  // Get platform account for event lock
  const platformAccountId = await getPlatformAccount(supabase);

  // CRITICAL: Acquire event lock for refund/chargeback (prevents double debit)
  const lockResult = await tryAcquireEventLock(supabase, referenceId, platformAccountId, saleId);
  if (lockResult === 'already_processed') {
    console.log(`[SplitEngine] ${kind} event already processed (lock + splits exist), skipping`);
    return;
  }
  // For 'needs_recovery' or 'acquired', continue processing

  // Get all liable splits for this sale
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

  // Debit each liable account
  for (const split of liableSplits) {
    const account = split.virtual_account as Record<string, unknown>;
    if (!account?.id) continue;

    const debitAmount = split.net_amount_cents || split.gross_amount_cents || 0;
    const txReferenceId = `${referenceId}:${kind}:${split.split_type}`;

    try {
      // ROBUST: Use split.transaction_id to find the EXACT original transaction status
      // This eliminates ambiguity when same account has multiple credits
      let originalStatus = 'pending';
      
      if (split.transaction_id) {
        // Best case: we have the direct link to the original transaction
        const { data: linkedTx } = await supabase
          .from('virtual_transactions')
          .select('status')
          .eq('id', split.transaction_id)
          .single();
        originalStatus = linkedTx?.status || 'pending';
      } else {
        // Fallback: find by sale_id + account (less precise but works for legacy)
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

      // Create debit transaction (idempotent)
      const { error: txError } = await supabase
        .from('virtual_transactions')
        .insert({
          virtual_account_id: account.id,
          sale_id: saleId,
          transaction_type: kind,
          amount_cents: -debitAmount,
          fee_cents: 0,
          net_amount_cents: -debitAmount,
          description: `${kind === 'refund' ? 'Reembolso' : 'Chargeback'} - Venda #${saleId.slice(0, 8)} (from ${debitFromPending ? 'pending' : 'balance'})`,
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

      // CRITICAL: Debit from correct balance based on original transaction status
      // If original was still pending, debit pending_balance
      // If original was released/completed, debit balance
      if (debitFromPending) {
        // Debit from pending_balance_cents (original credit not yet released)
        await supabase
          .from('virtual_accounts')
          .update({
            pending_balance_cents: ((account.pending_balance_cents as number) || 0) - debitAmount,
          })
          .eq('id', account.id);
        console.log(`[SplitEngine] Debited R$${(debitAmount / 100).toFixed(2)} from ${split.split_type} PENDING balance for ${kind}`);
      } else {
        // Debit from balance_cents (original credit already released) - can go negative
        await supabase
          .from('virtual_accounts')
          .update({
            balance_cents: ((account.balance_cents as number) || 0) - debitAmount,
          })
          .eq('id', account.id);
        console.log(`[SplitEngine] Debited R$${(debitAmount / 100).toFixed(2)} from ${split.split_type} AVAILABLE balance for ${kind}`);
      }

    } catch (error) {
      if (!isUniqueViolation(error)) {
        console.error(`[SplitEngine] Error processing ${kind} for ${split.split_type}:`, error);
      }
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

  console.log(`[SplitEngine] Completed ${kind} processing for sale ${saleId}`);
}
