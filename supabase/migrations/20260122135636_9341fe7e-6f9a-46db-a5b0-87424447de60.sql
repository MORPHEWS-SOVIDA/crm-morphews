-- =============================================================================
-- FOCUS NFE INTEGRATION: Fiscal Companies, Product Fields & Invoices
-- =============================================================================

-- 1. Empresas fiscais (CNPJs) por tenant
CREATE TABLE IF NOT EXISTS public.fiscal_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,           -- Razão social
  trade_name TEXT,                      -- Nome fantasia
  cnpj TEXT NOT NULL,                   -- 14 dígitos (sem formatação)
  state_registration TEXT,              -- Inscrição estadual
  municipal_registration TEXT,          -- Inscrição municipal (para NFSe)
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_city_code TEXT,               -- Código IBGE da cidade (7 dígitos)
  address_state TEXT,                   -- UF (2 letras)
  address_zip TEXT,                     -- CEP (8 dígitos sem formatação)
  phone TEXT,
  email TEXT,
  tax_regime TEXT NOT NULL DEFAULT 'simples_nacional', -- 'simples_nacional', 'lucro_presumido', 'lucro_real'
  certificate_file_path TEXT,           -- Path do certificado A1 no storage
  certificate_password_encrypted TEXT,  -- Senha criptografada
  is_primary BOOLEAN DEFAULT false,     -- CNPJ principal do tenant
  is_active BOOLEAN DEFAULT true,
  focus_nfe_company_id TEXT,            -- ID retornado pelo Focus após cadastro
  default_cfop_internal TEXT DEFAULT '5102',      -- CFOP vendas dentro do estado
  default_cfop_interstate TEXT DEFAULT '6102',   -- CFOP vendas fora do estado
  default_cst TEXT DEFAULT '102',                 -- CST padrão (102 = Simples sem crédito)
  nfse_municipal_code TEXT,             -- Código municipal de serviço padrão
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_companies_cnpj_org_unique UNIQUE (organization_id, cnpj)
);

-- 2. Campos fiscais nos produtos
ALTER TABLE public.lead_products ADD COLUMN IF NOT EXISTS fiscal_ncm TEXT;           -- NCM 8 dígitos
ALTER TABLE public.lead_products ADD COLUMN IF NOT EXISTS fiscal_cfop TEXT;          -- CFOP padrão do produto
ALTER TABLE public.lead_products ADD COLUMN IF NOT EXISTS fiscal_cst TEXT;           -- CST/CSOSN
ALTER TABLE public.lead_products ADD COLUMN IF NOT EXISTS fiscal_origin INTEGER DEFAULT 0;     -- 0=Nacional, 1-8=Importado
ALTER TABLE public.lead_products ADD COLUMN IF NOT EXISTS fiscal_product_type TEXT DEFAULT 'product';  -- 'product', 'service', 'mixed'
ALTER TABLE public.lead_products ADD COLUMN IF NOT EXISTS fiscal_lc116_code TEXT;    -- Código LC 116 (para serviços)
ALTER TABLE public.lead_products ADD COLUMN IF NOT EXISTS fiscal_company_id UUID REFERENCES public.fiscal_companies(id);
ALTER TABLE public.lead_products ADD COLUMN IF NOT EXISTS fiscal_iss_aliquota NUMERIC(5,2); -- Alíquota ISS para serviços

-- 3. Notas fiscais emitidas
CREATE TABLE IF NOT EXISTS public.fiscal_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fiscal_company_id UUID NOT NULL REFERENCES public.fiscal_companies(id),
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  invoice_type TEXT NOT NULL,           -- 'nfe', 'nfse', 'nfce'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'authorized', 'rejected', 'cancelled'
  focus_nfe_ref TEXT NOT NULL,          -- Referência única enviada ao Focus
  focus_nfe_id TEXT,                    -- ID retornado pelo Focus
  invoice_number TEXT,                  -- Número da nota
  invoice_series TEXT,                  -- Série
  access_key TEXT,                      -- Chave de acesso (44 dígitos para NFe)
  verification_code TEXT,               -- Código de verificação (NFSe)
  protocol_number TEXT,
  xml_url TEXT,                         -- URL do XML
  pdf_url TEXT,                         -- URL do DANFE/PDF
  total_cents INTEGER NOT NULL,
  error_message TEXT,
  focus_nfe_response JSONB,
  items JSONB,                          -- Itens da nota (snapshot no momento da emissão)
  customer_data JSONB,                  -- Dados do cliente (snapshot)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  authorized_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  CONSTRAINT fiscal_invoices_ref_unique UNIQUE (focus_nfe_ref)
);

-- 4. Histórico de eventos das notas (para webhook)
CREATE TABLE IF NOT EXISTS public.fiscal_invoice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_invoice_id UUID NOT NULL REFERENCES public.fiscal_invoices(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,             -- 'created', 'processing', 'authorized', 'rejected', 'cancelled'
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. RLS Policies
ALTER TABLE public.fiscal_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_invoice_events ENABLE ROW LEVEL SECURITY;

-- fiscal_companies policies
CREATE POLICY "Users can view fiscal companies of their organization"
  ON public.fiscal_companies FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can insert fiscal companies"
  ON public.fiscal_companies FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Admins can update fiscal companies"
  ON public.fiscal_companies FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Admins can delete fiscal companies"
  ON public.fiscal_companies FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- fiscal_invoices policies
CREATE POLICY "Users can view fiscal invoices of their organization"
  ON public.fiscal_invoices FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert fiscal invoices of their organization"
  ON public.fiscal_invoices FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update fiscal invoices of their organization"
  ON public.fiscal_invoices FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- fiscal_invoice_events policies
CREATE POLICY "Users can view fiscal invoice events of their organization"
  ON public.fiscal_invoice_events FOR SELECT
  USING (fiscal_invoice_id IN (
    SELECT id FROM public.fiscal_invoices WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "System can insert fiscal invoice events"
  ON public.fiscal_invoice_events FOR INSERT
  WITH CHECK (true);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fiscal_companies_org ON public.fiscal_companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_org ON public.fiscal_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_sale ON public.fiscal_invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_status ON public.fiscal_invoices(status);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_focus_ref ON public.fiscal_invoices(focus_nfe_ref);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoice_events_invoice ON public.fiscal_invoice_events(fiscal_invoice_id);
CREATE INDEX IF NOT EXISTS idx_products_fiscal_company ON public.lead_products(fiscal_company_id);

-- 7. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_fiscal_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_fiscal_companies_updated_at ON public.fiscal_companies;
CREATE TRIGGER update_fiscal_companies_updated_at
  BEFORE UPDATE ON public.fiscal_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_fiscal_companies_updated_at();

-- 8. Storage bucket para certificados A1
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fiscal-certificates', 'fiscal-certificates', false, 52428800, ARRAY['application/x-pkcs12', 'application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for certificates
CREATE POLICY "Admins can upload certificates"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'fiscal-certificates' AND
    EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can view certificates"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'fiscal-certificates' AND
    EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete certificates"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'fiscal-certificates' AND
    EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );