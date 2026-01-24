
-- =====================================================
-- MIGRATION: Checkout Engine v3 - Complete Split System
-- Based on ChatGPT analysis + existing schema
-- =====================================================

-- =====================================================
-- 1) EXPAND virtual_accounts.account_type
-- Add 'factory', 'industry', 'platform' types
-- =====================================================
DO $$
BEGIN
  -- Drop existing constraint if any
  ALTER TABLE public.virtual_accounts 
    DROP CONSTRAINT IF EXISTS virtual_accounts_account_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.virtual_accounts
  ADD CONSTRAINT virtual_accounts_account_type_check
  CHECK (account_type IN ('tenant', 'affiliate', 'coproducer', 'factory', 'industry', 'platform'));

-- =====================================================
-- 2) virtual_transactions - IDEMPOTENCY
-- Add unique index on reference_id for strong idempotency
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS ux_virtual_tx_idempotency
ON public.virtual_transactions (virtual_account_id, reference_id, transaction_type)
WHERE reference_id IS NOT NULL;

-- =====================================================
-- 3) sale_splits - Add priority + liability flags
-- =====================================================
ALTER TABLE public.sale_splits
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS liable_for_refund boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS liable_for_chargeback boolean NOT NULL DEFAULT false;

-- Add check constraint for split_type (includes factory)
DO $$
BEGIN
  ALTER TABLE public.sale_splits 
    DROP CONSTRAINT IF EXISTS sale_splits_split_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.sale_splits
  ADD CONSTRAINT sale_splits_split_type_check
  CHECK (split_type IN ('tenant', 'platform_fee', 'affiliate', 'industry', 'factory', 'gateway_fee'));

-- =====================================================
-- 4) FACTORIES table + product_factory_costs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.factories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  legal_name text,
  document text, -- CNPJ
  email text,
  phone text,
  -- Bank data (like industries)
  bank_name text,
  bank_agency text,
  bank_account text,
  bank_account_type text DEFAULT 'corrente',
  pix_key text,
  -- Optional virtual account for internal wallet
  virtual_account_id uuid REFERENCES public.virtual_accounts(id),
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_factories_org ON public.factories(organization_id);

-- Factory costs per product
CREATE TABLE IF NOT EXISTS public.product_factory_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  factory_id uuid NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Factory fee (calculated before tenant/affiliate split)
  factory_fee_percent numeric NOT NULL DEFAULT 0,
  factory_fee_fixed_cents integer NOT NULL DEFAULT 0,
  -- Cost fields (like industry)
  unit_cost_cents integer DEFAULT 0,
  shipping_cost_cents integer DEFAULT 0,
  additional_cost_cents integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, factory_id)
);

CREATE INDEX IF NOT EXISTS idx_pfc_product ON public.product_factory_costs(product_id);
CREATE INDEX IF NOT EXISTS idx_pfc_factory ON public.product_factory_costs(factory_id);

-- =====================================================
-- 5) Add virtual_account_id to industries (optional wallet)
-- =====================================================
ALTER TABLE public.industries
  ADD COLUMN IF NOT EXISTS virtual_account_id uuid REFERENCES public.virtual_accounts(id);

-- =====================================================
-- 6) organization_split_rules - Per-tenant split config
-- =====================================================
CREATE TABLE IF NOT EXISTS public.organization_split_rules (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Fee percentages
  platform_fee_percent numeric NOT NULL DEFAULT 4.99,
  platform_fee_fixed_cents integer NOT NULL DEFAULT 100,
  default_affiliate_percent numeric NOT NULL DEFAULT 10,
  -- Hold days by type
  hold_days_tenant integer NOT NULL DEFAULT 7,
  hold_days_affiliate integer NOT NULL DEFAULT 15,
  hold_days_platform integer NOT NULL DEFAULT 0,
  hold_days_industry integer NOT NULL DEFAULT 0, -- "à vista"
  hold_days_factory integer NOT NULL DEFAULT 0, -- "à vista"
  -- Liability rules
  allow_negative_balance boolean NOT NULL DEFAULT true,
  chargeback_debit_strategy text NOT NULL DEFAULT 'proportional'
    CHECK (chargeback_debit_strategy IN ('tenant_first', 'affiliate_first', 'proportional')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- 7) affiliate_attributions - Single source of truth for attribution
-- =====================================================
CREATE TABLE IF NOT EXISTS public.affiliate_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  attribution_type text NOT NULL CHECK (attribution_type IN ('link', 'coupon', 'manual', 'utm')),
  code_or_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sale_id) -- 1 sale = 1 final attribution
);

CREATE INDEX IF NOT EXISTS idx_aff_attr_org ON public.affiliate_attributions(organization_id);
CREATE INDEX IF NOT EXISTS idx_aff_attr_affiliate ON public.affiliate_attributions(affiliate_id);

-- =====================================================
-- 8) COUPONS table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric NOT NULL, -- percent (0-100) or cents (if fixed)
  -- Optional affiliate link (coupon = affiliate attribution)
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  -- Restrictions
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  max_redemptions integer,
  redemptions_count integer NOT NULL DEFAULT 0,
  min_order_cents integer DEFAULT 0,
  -- Products restriction (null = all products)
  product_ids uuid[] DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_coupons_org ON public.coupons(organization_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);

-- =====================================================
-- 9) PLATFORM virtual_account (Morphews singleton)
-- =====================================================
-- Create a special platform account for receiving platform_fee splits
INSERT INTO public.virtual_accounts (
  id,
  organization_id,
  account_type,
  holder_name,
  holder_email,
  balance_cents,
  pending_balance_cents,
  total_received_cents,
  total_withdrawn_cents
) 
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  (SELECT id FROM public.organizations LIMIT 1), -- Will be updated to proper platform org
  'platform',
  'Morphews Platform',
  'financeiro@morphews.com',
  0, 0, 0, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.virtual_accounts WHERE account_type = 'platform'
);

-- =====================================================
-- 10) RLS Policies for new tables
-- =====================================================

-- factories
ALTER TABLE public.factories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org factories"
ON public.factories FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Admins can manage factories"
ON public.factories FOR ALL
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members 
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
));

-- product_factory_costs
ALTER TABLE public.product_factory_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org factory costs"
ON public.product_factory_costs FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Admins can manage factory costs"
ON public.product_factory_costs FOR ALL
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members 
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
));

-- organization_split_rules
ALTER TABLE public.organization_split_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org split rules"
ON public.organization_split_rules FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Admins can manage split rules"
ON public.organization_split_rules FOR ALL
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members 
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
));

-- affiliate_attributions
ALTER TABLE public.affiliate_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org attributions"
ON public.affiliate_attributions FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "System can manage attributions"
ON public.affiliate_attributions FOR ALL
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members 
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
));

-- coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org coupons"
ON public.coupons FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Admins can manage coupons"
ON public.coupons FOR ALL
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members 
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
));

-- =====================================================
-- 11) Comments for documentation
-- =====================================================
COMMENT ON TABLE public.factories IS 'Fábricas/fornecedores que recebem valor por unidade vendida (priority 1, antes do tenant)';
COMMENT ON TABLE public.product_factory_costs IS 'Custo da fábrica por produto (% ou fixo)';
COMMENT ON TABLE public.organization_split_rules IS 'Regras de split customizadas por tenant';
COMMENT ON TABLE public.affiliate_attributions IS 'Atribuição única de afiliado por venda (link, cupom, manual)';
COMMENT ON TABLE public.coupons IS 'Cupons de desconto com opcional vínculo a afiliado';
COMMENT ON COLUMN public.sale_splits.priority IS '1=factory (primeiro), 2=outros';
COMMENT ON COLUMN public.sale_splits.liable_for_refund IS 'Se participa do débito em caso de reembolso';
COMMENT ON COLUMN public.sale_splits.liable_for_chargeback IS 'Se participa do débito em caso de chargeback';
