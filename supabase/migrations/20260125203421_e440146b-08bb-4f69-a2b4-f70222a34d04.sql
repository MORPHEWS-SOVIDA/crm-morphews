-- Add bank account link to cost centers (CNPJ)
ALTER TABLE public.payment_cost_centers
ADD COLUMN IF NOT EXISTS default_bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

-- Add CNPJ field to cost centers if not exists
ALTER TABLE public.payment_cost_centers
ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- Add cost center link to suppliers
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.payment_cost_centers(id) ON DELETE SET NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cost_centers_bank_account ON public.payment_cost_centers(default_bank_account_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_cost_center ON public.suppliers(cost_center_id);

-- Add comments for documentation
COMMENT ON COLUMN public.payment_cost_centers.default_bank_account_id IS 'Conta bancária padrão para recebimentos/pagamentos deste centro de custo';
COMMENT ON COLUMN public.payment_cost_centers.cnpj IS 'CNPJ associado a este centro de custo';
COMMENT ON COLUMN public.suppliers.cost_center_id IS 'Centro de custo padrão para pagamentos a este fornecedor';