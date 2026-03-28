
-- Add cost_center to virtual_accounts account_type constraint
ALTER TABLE public.virtual_accounts DROP CONSTRAINT IF EXISTS virtual_accounts_account_type_check;
ALTER TABLE public.virtual_accounts ADD CONSTRAINT virtual_accounts_account_type_check 
  CHECK (account_type = ANY (ARRAY[
    'tenant', 'affiliate', 'coproducer', 'factory', 'industry', 'platform', 'cost_center'
  ]));

-- Create virtual accounts for cost categories (SoVida org)
INSERT INTO public.virtual_accounts (id, organization_id, account_type, holder_name, holder_email, balance_cents, pending_balance_cents, total_received_cents, total_withdrawn_cents)
VALUES 
  ('a0000001-0000-0000-0000-000000000001', '650b1667-e345-498e-9d41-b963faf824a7', 'cost_center', 'Gateway Pagarme', 'pagarme@sonatura.com.br', 0, 0, 0, 0),
  ('a0000001-0000-0000-0000-000000000002', '650b1667-e345-498e-9d41-b963faf824a7', 'cost_center', 'Correios + Picking', 'correio@sonatura.com.br', 0, 0, 0, 0),
  ('a0000001-0000-0000-0000-000000000003', '650b1667-e345-498e-9d41-b963faf824a7', 'cost_center', 'Farmácia (Produção)', 'farmacia@sonatura.com.br', 0, 0, 0, 0),
  ('a0000001-0000-0000-0000-000000000004', '650b1667-e345-498e-9d41-b963faf824a7', 'cost_center', 'Impostos (12%)', 'imposto@sonatura.com.br', 0, 0, 0, 0)
ON CONFLICT DO NOTHING;

-- Update all coproducers to percentage type with 50% of net profit
UPDATE public.coproducers 
SET commission_type = 'percentage', 
    commission_percentage = 50,
    commission_fixed_1_cents = 0,
    commission_fixed_3_cents = 0,
    commission_fixed_5_cents = 0
WHERE is_active = true;
