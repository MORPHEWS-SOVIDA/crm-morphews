-- =============================================================
-- MÓDULO FINANCEIRO COMPLETO - PADRÃO ERP
-- =============================================================

-- 1. FORNECEDORES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade_name TEXT,
  cnpj TEXT,
  cpf TEXT,
  ie TEXT,
  im TEXT,
  email TEXT,
  phone TEXT,
  contact_name TEXT,
  cep TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  bank_name TEXT,
  bank_agency TEXT,
  bank_account TEXT,
  bank_account_type TEXT,
  pix_key TEXT,
  pix_key_type TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org ON public.suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_cnpj ON public.suppliers(organization_id, cnpj);

-- 2. CONTAS BANCÁRIAS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_code TEXT,
  bank_name TEXT,
  agency TEXT,
  agency_digit TEXT,
  account_number TEXT,
  account_digit TEXT,
  account_type TEXT DEFAULT 'corrente',
  initial_balance_cents INTEGER DEFAULT 0,
  current_balance_cents INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_org ON public.bank_accounts(organization_id);

-- 3. CATEGORIAS FINANCEIRAS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.financial_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id UUID REFERENCES public.financial_categories(id),
  dre_group TEXT,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_categories_org ON public.financial_categories(organization_id);

-- 4. CONTAS A PAGAR
-- =====================================================
CREATE TABLE IF NOT EXISTS public.accounts_payable (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  purchase_invoice_id UUID REFERENCES public.purchase_invoices(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  document_number TEXT,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_amount_cents INTEGER DEFAULT 0,
  discount_cents INTEGER DEFAULT 0,
  interest_cents INTEGER DEFAULT 0,
  fine_cents INTEGER DEFAULT 0,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  installment_number INTEGER DEFAULT 1,
  total_installments INTEGER DEFAULT 1,
  payment_method TEXT,
  barcode TEXT,
  pix_code TEXT,
  category_id UUID REFERENCES public.financial_categories(id),
  cost_center_id UUID REFERENCES public.payment_cost_centers(id),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  status TEXT DEFAULT 'pending',
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_type TEXT,
  recurrence_end_date DATE,
  parent_payable_id UUID REFERENCES public.accounts_payable(id),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_payable_org ON public.accounts_payable(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_supplier ON public.accounts_payable(supplier_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_due ON public.accounts_payable(organization_id, due_date);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_status ON public.accounts_payable(organization_id, status);

-- 5. REGRAS DE APROVAÇÃO
-- =====================================================
CREATE TABLE IF NOT EXISTS public.financial_approval_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_amount_cents INTEGER NOT NULL,
  max_amount_cents INTEGER,
  approver_user_ids UUID[],
  require_all_approvers BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. TRANSAÇÕES BANCÁRIAS (OFX)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  fitid TEXT,
  transaction_date DATE NOT NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT,
  memo TEXT,
  check_number TEXT,
  ref_number TEXT,
  transaction_type TEXT,
  is_reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID,
  account_payable_id UUID REFERENCES public.accounts_payable(id),
  sale_installment_id UUID REFERENCES public.sale_installments(id),
  manual_entry_id UUID,
  import_batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON public.bank_transactions(bank_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transactions_fitid ON public.bank_transactions(bank_account_id, fitid) WHERE fitid IS NOT NULL;

-- 7. IMPORTAÇÕES OFX
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ofx_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  file_name TEXT,
  import_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_date DATE,
  end_date DATE,
  total_transactions INTEGER DEFAULT 0,
  new_transactions INTEGER DEFAULT 0,
  duplicate_transactions INTEGER DEFAULT 0,
  imported_by UUID,
  status TEXT DEFAULT 'completed',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ALTERAÇÕES EM TABELAS EXISTENTES
-- =====================================================
ALTER TABLE public.purchase_invoices 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id),
ADD COLUMN IF NOT EXISTS payment_condition TEXT,
ADD COLUMN IF NOT EXISTS installments_generated BOOLEAN DEFAULT false;

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS financial_approval_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS financial_approval_min_cents INTEGER DEFAULT 100000;

-- 9. RLS
-- =====================================================
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ofx_imports ENABLE ROW LEVEL SECURITY;

-- Suppliers
CREATE POLICY "suppliers_policy" ON public.suppliers FOR ALL 
USING (organization_id = get_user_organization_id());

-- Bank Accounts
CREATE POLICY "bank_accounts_policy" ON public.bank_accounts FOR ALL 
USING (organization_id = get_user_organization_id());

-- Financial Categories
CREATE POLICY "financial_categories_policy" ON public.financial_categories FOR ALL 
USING (organization_id = get_user_organization_id());

-- Accounts Payable
CREATE POLICY "accounts_payable_policy" ON public.accounts_payable FOR ALL 
USING (organization_id = get_user_organization_id());

-- Approval Rules
CREATE POLICY "approval_rules_policy" ON public.financial_approval_rules FOR ALL 
USING (organization_id = get_user_organization_id());

-- Bank Transactions
CREATE POLICY "bank_transactions_policy" ON public.bank_transactions FOR ALL 
USING (organization_id = get_user_organization_id());

-- OFX Imports
CREATE POLICY "ofx_imports_policy" ON public.ofx_imports FOR ALL 
USING (organization_id = get_user_organization_id());

-- 10. FUNÇÕES E TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_bank_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.bank_accounts
  SET current_balance_cents = initial_balance_cents + COALESCE((
    SELECT SUM(amount_cents)
    FROM public.bank_transactions
    WHERE bank_account_id = COALESCE(NEW.bank_account_id, OLD.bank_account_id)
    AND is_reconciled = true
  ), 0),
  updated_at = now()
  WHERE id = COALESCE(NEW.bank_account_id, OLD.bank_account_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_bank_balance ON public.bank_transactions;
CREATE TRIGGER trg_update_bank_balance
AFTER INSERT OR UPDATE OR DELETE ON public.bank_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_bank_account_balance();

CREATE OR REPLACE FUNCTION public.check_payable_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_approval_enabled BOOLEAN;
  v_min_amount INTEGER;
BEGIN
  SELECT financial_approval_enabled, financial_approval_min_cents
  INTO v_approval_enabled, v_min_amount
  FROM public.organizations
  WHERE id = NEW.organization_id;
  
  IF v_approval_enabled AND NEW.amount_cents >= COALESCE(v_min_amount, 100000) THEN
    NEW.requires_approval := true;
    NEW.status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_payable_approval ON public.accounts_payable;
CREATE TRIGGER trg_check_payable_approval
BEFORE INSERT ON public.accounts_payable
FOR EACH ROW
EXECUTE FUNCTION public.check_payable_approval();