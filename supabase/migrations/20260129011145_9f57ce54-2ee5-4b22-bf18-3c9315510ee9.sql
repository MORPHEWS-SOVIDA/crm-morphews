-- =============================================
-- SISTEMA DE LINK DE PAGAMENTO E TELEVENDAS
-- =============================================

-- 1. TABELA DE LINKS DE PAGAMENTO
-- Cada organização pode criar links para cobrar clientes
CREATE TABLE IF NOT EXISTS public.payment_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  
  -- Identificação
  title TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL, -- URL amigável única
  
  -- Valor e configuração
  amount_cents INTEGER, -- NULL = valor livre
  allow_custom_amount BOOLEAN DEFAULT false,
  min_amount_cents INTEGER DEFAULT 100,
  max_amount_cents INTEGER,
  
  -- Métodos de pagamento permitidos (herda do tenant_payment_fees se NULL)
  pix_enabled BOOLEAN DEFAULT true,
  boleto_enabled BOOLEAN DEFAULT true,
  card_enabled BOOLEAN DEFAULT true,
  max_installments INTEGER DEFAULT 12, -- NULL = usa config do tenant
  
  -- Validade
  expires_at TIMESTAMPTZ,
  max_uses INTEGER, -- NULL = ilimitado
  use_count INTEGER DEFAULT 0,
  
  -- Cliente pré-definido (opcional)
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_document TEXT,
  lead_id UUID REFERENCES public.leads(id),
  
  -- Referência externa
  external_reference TEXT,
  notes TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice único para slug por organização
CREATE UNIQUE INDEX idx_payment_links_slug_org ON public.payment_links(organization_id, slug);
CREATE INDEX idx_payment_links_org ON public.payment_links(organization_id);
CREATE INDEX idx_payment_links_created_by ON public.payment_links(created_by);

-- RLS
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org payment links" ON public.payment_links
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create org payment links" ON public.payment_links
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update org payment links" ON public.payment_links
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view active payment links by slug" ON public.payment_links
  FOR SELECT USING (is_active = true);

-- 2. TABELA DE TRANSAÇÕES DE LINK DE PAGAMENTO
CREATE TABLE IF NOT EXISTS public.payment_link_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_link_id UUID REFERENCES public.payment_links(id) ON DELETE SET NULL,
  
  -- Tipo de origem (link, televendas, receptivo, etc)
  origin_type TEXT NOT NULL DEFAULT 'payment_link', -- 'payment_link', 'telesales', 'receptive'
  
  -- Dados do cliente
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_document TEXT,
  
  -- Valores
  amount_cents INTEGER NOT NULL,
  fee_cents INTEGER DEFAULT 0, -- Taxa da plataforma
  net_amount_cents INTEGER GENERATED ALWAYS AS (amount_cents - fee_cents) STORED,
  
  -- Gateway
  payment_method TEXT NOT NULL, -- 'pix', 'boleto', 'credit_card'
  gateway_type TEXT DEFAULT 'pagarme',
  gateway_order_id TEXT,
  gateway_charge_id TEXT,
  gateway_transaction_id TEXT,
  
  -- Cartão (se aplicável)
  card_brand TEXT,
  card_last_digits TEXT,
  installments INTEGER DEFAULT 1,
  installment_fee_cents INTEGER DEFAULT 0,
  
  -- PIX/Boleto (se aplicável)
  pix_qr_code TEXT,
  pix_qr_code_url TEXT,
  pix_expires_at TIMESTAMPTZ,
  boleto_url TEXT,
  boleto_barcode TEXT,
  boleto_expires_at TIMESTAMPTZ,
  
  -- Status e datas
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled'
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Liberação de valores
  release_date DATE, -- Data prevista de liberação
  released_at TIMESTAMPTZ,
  
  -- Referência ao split
  virtual_account_id UUID REFERENCES public.virtual_accounts(id),
  
  -- Criado por (para televendas)
  created_by UUID REFERENCES auth.users(id),
  sale_id UUID REFERENCES public.sales(id), -- Se vinculado a uma venda
  lead_id UUID REFERENCES public.leads(id),
  
  -- Metadados
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  gateway_response JSONB,
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plt_org ON public.payment_link_transactions(organization_id);
CREATE INDEX idx_plt_status ON public.payment_link_transactions(status);
CREATE INDEX idx_plt_payment_link ON public.payment_link_transactions(payment_link_id);
CREATE INDEX idx_plt_created_by ON public.payment_link_transactions(created_by);
CREATE INDEX idx_plt_gateway_order ON public.payment_link_transactions(gateway_order_id);
CREATE INDEX idx_plt_release_date ON public.payment_link_transactions(release_date) WHERE status = 'paid';

-- RLS
ALTER TABLE public.payment_link_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org transactions" ON public.payment_link_transactions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create org transactions" ON public.payment_link_transactions
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super Admin can view all transactions" ON public.payment_link_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 3. ADICIONAR FEATURE KEYS PARA LINK DE PAGAMENTO E TELEVENDAS NO SISTEMA
-- (As features já existem: payment_gateways, telesales, virtual_wallet)
-- Vamos adicionar uma nova feature específica para links de pagamento
INSERT INTO public.plan_features (plan_id, feature_key, is_enabled)
SELECT p.id, 'payment_links', false
FROM public.subscription_plans p
WHERE NOT EXISTS (
  SELECT 1 FROM public.plan_features pf 
  WHERE pf.plan_id = p.id AND pf.feature_key = 'payment_links'
)
ON CONFLICT DO NOTHING;

-- 4. ADICIONAR COLUNAS DE PERMISSÃO NO user_permissions
-- Verificar se as colunas existem e adicionar se não existirem
DO $$
BEGIN
  -- Permissão para criar links de pagamento
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'payment_links_create') THEN
    ALTER TABLE public.user_permissions ADD COLUMN payment_links_create BOOLEAN DEFAULT false;
  END IF;
  
  -- Permissão para ver transações
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'payment_links_view_transactions') THEN
    ALTER TABLE public.user_permissions ADD COLUMN payment_links_view_transactions BOOLEAN DEFAULT false;
  END IF;
  
  -- Permissão para televendas (digitar cartão)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'telesales_charge_card') THEN
    ALTER TABLE public.user_permissions ADD COLUMN telesales_charge_card BOOLEAN DEFAULT false;
  END IF;
  
  -- Permissão para cadastrar conta bancária
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'bank_account_manage') THEN
    ALTER TABLE public.user_permissions ADD COLUMN bank_account_manage BOOLEAN DEFAULT false;
  END IF;
  
  -- Permissão para solicitar saques
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_permissions' AND column_name = 'withdrawal_request') THEN
    ALTER TABLE public.user_permissions ADD COLUMN withdrawal_request BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 5. TABELA DE CONFIGURAÇÃO DE TAXAS POR TENANT (se não existir, já deve existir)
-- Adicionar campos específicos para links de pagamento
DO $$
BEGIN
  -- Taxa específica para links (pode ser diferente do e-commerce)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_payment_fees' AND column_name = 'payment_link_enabled') THEN
    ALTER TABLE public.tenant_payment_fees ADD COLUMN payment_link_enabled BOOLEAN DEFAULT false;
  END IF;
  
  -- Televendas habilitado
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_payment_fees' AND column_name = 'telesales_enabled') THEN
    ALTER TABLE public.tenant_payment_fees ADD COLUMN telesales_enabled BOOLEAN DEFAULT false;
  END IF;
  
  -- Limite diário de transações (segurança)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_payment_fees' AND column_name = 'daily_transaction_limit_cents') THEN
    ALTER TABLE public.tenant_payment_fees ADD COLUMN daily_transaction_limit_cents BIGINT;
  END IF;
  
  -- Limite por transação
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_payment_fees' AND column_name = 'max_transaction_cents') THEN
    ALTER TABLE public.tenant_payment_fees ADD COLUMN max_transaction_cents BIGINT DEFAULT 500000; -- R$ 5.000,00 padrão
  END IF;
END $$;

-- 6. TABELA DE LOG DE TENTATIVAS (para segurança e auditoria)
CREATE TABLE IF NOT EXISTS public.payment_link_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_link_id UUID REFERENCES public.payment_links(id),
  transaction_id UUID REFERENCES public.payment_link_transactions(id),
  
  payment_method TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  
  status TEXT NOT NULL, -- 'approved', 'refused', 'error'
  error_code TEXT,
  error_message TEXT,
  gateway_response JSONB,
  
  customer_document TEXT,
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pla_org ON public.payment_link_attempts(organization_id);
CREATE INDEX idx_pla_link ON public.payment_link_attempts(payment_link_id);
CREATE INDEX idx_pla_status ON public.payment_link_attempts(status);

ALTER TABLE public.payment_link_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org attempts" ON public.payment_link_attempts
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super Admin can view all attempts" ON public.payment_link_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 7. TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
CREATE OR REPLACE FUNCTION public.update_payment_link_use_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    UPDATE public.payment_links 
    SET use_count = use_count + 1
    WHERE id = NEW.payment_link_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_update_payment_link_use_count ON public.payment_link_transactions;
CREATE TRIGGER trg_update_payment_link_use_count
  AFTER UPDATE ON public.payment_link_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payment_link_use_count();

-- Trigger para updated_at
CREATE TRIGGER update_payment_links_updated_at
  BEFORE UPDATE ON public.payment_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_link_transactions_updated_at
  BEFORE UPDATE ON public.payment_link_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. FUNÇÃO PARA GERAR SLUG ÚNICO
CREATE OR REPLACE FUNCTION public.generate_payment_link_slug()
RETURNS TEXT AS $$
DECLARE
  new_slug TEXT;
  slug_exists BOOLEAN;
BEGIN
  LOOP
    -- Gerar slug de 8 caracteres alfanuméricos
    new_slug := lower(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    
    -- Verificar se já existe
    SELECT EXISTS(SELECT 1 FROM public.payment_links WHERE slug = new_slug) INTO slug_exists;
    
    EXIT WHEN NOT slug_exists;
  END LOOP;
  
  RETURN new_slug;
END;
$$ LANGUAGE plpgsql SET search_path = public;