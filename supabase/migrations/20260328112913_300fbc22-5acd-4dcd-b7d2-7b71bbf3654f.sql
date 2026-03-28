
-- Add affiliate_manager support to tenant_storefronts
ALTER TABLE public.tenant_storefronts 
  ADD COLUMN IF NOT EXISTS affiliate_manager_account_id uuid REFERENCES public.virtual_accounts(id),
  ADD COLUMN IF NOT EXISTS affiliate_manager_percent numeric DEFAULT 0;

-- Update sale_splits split_type check to include affiliate_manager
ALTER TABLE public.sale_splits DROP CONSTRAINT IF EXISTS sale_splits_split_type_check;
ALTER TABLE public.sale_splits ADD CONSTRAINT sale_splits_split_type_check 
  CHECK (split_type IN ('tenant', 'platform_fee', 'affiliate', 'industry', 'factory', 'gateway_fee', 'coproducer', 'interest', 'tax', 'shipping', 'product_cost', 'affiliate_manager'));

-- Update virtual_accounts account_type check to include affiliate_manager
ALTER TABLE public.virtual_accounts DROP CONSTRAINT IF EXISTS virtual_accounts_account_type_check;
ALTER TABLE public.virtual_accounts ADD CONSTRAINT virtual_accounts_account_type_check 
  CHECK (account_type IN ('tenant', 'platform', 'industry', 'factory', 'coproducer', 'affiliate', 'cost_center', 'affiliate_manager'));
