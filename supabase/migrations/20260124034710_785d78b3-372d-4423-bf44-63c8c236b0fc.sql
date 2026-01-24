-- =====================================================
-- SISTEMA DE INDÚSTRIAS (Fornecedores) + TAXAS ATUALIZADAS
-- =====================================================

-- Tabela de Indústrias/Fornecedores cadastradas por tenant
CREATE TABLE public.industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  document TEXT, -- CNPJ
  email TEXT,
  phone TEXT,
  bank_name TEXT,
  bank_agency TEXT,
  bank_account TEXT,
  bank_account_type TEXT DEFAULT 'corrente', -- corrente, poupanca
  pix_key TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Configuração de custo da indústria POR PRODUTO
CREATE TABLE public.product_industry_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES lead_products(id) ON DELETE CASCADE NOT NULL,
  industry_id UUID REFERENCES industries(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  -- Custos por unidade vendida
  unit_cost_cents INT NOT NULL DEFAULT 0, -- Custo por unidade (ex: R$ 30)
  shipping_cost_cents INT DEFAULT 0, -- Frete por unidade (ex: R$ 15)
  additional_cost_cents INT DEFAULT 0, -- Custo adicional (ex: R$ 10)
  -- Descrição dos custos
  unit_cost_description TEXT,
  shipping_cost_description TEXT,
  additional_cost_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, industry_id)
);

-- Adicionar tipo 'industry' ao enum de split se ainda não existe
-- e coluna para industry_id na sale_splits
ALTER TABLE public.sale_splits 
ADD COLUMN IF NOT EXISTS industry_id UUID REFERENCES industries(id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_industries_organization ON industries(organization_id);
CREATE INDEX IF NOT EXISTS idx_industries_active ON industries(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_product_industry_costs_product ON product_industry_costs(product_id);
CREATE INDEX IF NOT EXISTS idx_product_industry_costs_industry ON product_industry_costs(industry_id);
CREATE INDEX IF NOT EXISTS idx_sale_splits_industry ON sale_splits(industry_id);

-- RLS para industries
ALTER TABLE public.industries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants podem ver suas indústrias"
  ON public.industries FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants podem gerenciar suas indústrias"
  ON public.industries FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- RLS para product_industry_costs
ALTER TABLE public.product_industry_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants podem ver custos de indústria"
  ON public.product_industry_costs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants podem gerenciar custos de indústria"
  ON public.product_industry_costs FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Atualizar taxas padrão da plataforma
UPDATE public.platform_settings 
SET setting_value = '{"percentage": 4.99, "fixed_cents": 100}'
WHERE setting_key = 'platform_fees';

-- Atualizar prazos padrão de saque
UPDATE public.platform_settings 
SET setting_value = '{"min_amount_cents": 5000, "release_days": 14, "fee_percentage": 0, "fee_fixed_cents": 0, "security_reserve_percentage": 10, "security_reserve_days": 15}'
WHERE setting_key = 'withdrawal_rules';

-- Inserir configuração de taxas por modalidade (padrão plataforma)
INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES (
  'payment_method_fees',
  '{
    "card": {"percentage": 3.99, "fixed_cents": 100, "release_days": 3},
    "pix": {"percentage": 1.99, "fixed_cents": 0, "release_days": 1},
    "boleto": {"percentage": 1.99, "fixed_cents": 400, "release_days": 1}
  }',
  'Taxas padrão por modalidade de pagamento'
)
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- Atualizar defaults da tabela tenant_payment_fees com valores corretos
ALTER TABLE public.tenant_payment_fees 
  ALTER COLUMN card_fee_percentage SET DEFAULT 3.99,
  ALTER COLUMN card_fee_fixed_cents SET DEFAULT 100,
  ALTER COLUMN card_release_days SET DEFAULT 3,
  ALTER COLUMN pix_fee_percentage SET DEFAULT 1.99,
  ALTER COLUMN pix_fee_fixed_cents SET DEFAULT 0,
  ALTER COLUMN pix_release_days SET DEFAULT 1,
  ALTER COLUMN boleto_fee_percentage SET DEFAULT 1.99,
  ALTER COLUMN boleto_fee_fixed_cents SET DEFAULT 400,
  ALTER COLUMN boleto_release_days SET DEFAULT 1;