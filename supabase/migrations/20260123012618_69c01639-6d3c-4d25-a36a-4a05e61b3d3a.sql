-- =====================================================
-- FASE 1-2: STOREFRONTS + TEMPLATES + LANDING PAGES
-- =====================================================

-- Templates disponíveis para lojas (gerenciados pelo super-admin)
CREATE TABLE public.storefront_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  preview_image_url TEXT,
  template_type TEXT NOT NULL DEFAULT 'store' CHECK (template_type IN ('store', 'landing_page')),
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lojas/Storefronts dos tenants
CREATE TABLE public.tenant_storefronts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  template_id UUID REFERENCES public.storefront_templates(id),
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#000000',
  secondary_color TEXT DEFAULT '#ffffff',
  custom_css TEXT,
  meta_title TEXT,
  meta_description TEXT,
  google_analytics_id TEXT,
  facebook_pixel_id TEXT,
  whatsapp_number TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug)
);

-- Domínios customizados para storefronts
CREATE TABLE public.storefront_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storefront_id UUID NOT NULL REFERENCES public.tenant_storefronts(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN DEFAULT false,
  ssl_status TEXT DEFAULT 'pending' CHECK (ssl_status IN ('pending', 'active', 'failed')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Produtos visíveis em cada storefront
CREATE TABLE public.storefront_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storefront_id UUID NOT NULL REFERENCES public.tenant_storefronts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  display_order INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  custom_price_cents INT, -- preço customizado para este storefront (null = usa preço do produto)
  custom_description TEXT,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(storefront_id, product_id)
);

-- Landing Pages (VSL) para produto único
CREATE TABLE public.landing_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.storefront_templates(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  headline TEXT,
  subheadline TEXT,
  video_url TEXT,
  benefits JSONB DEFAULT '[]',
  testimonials JSONB DEFAULT '[]',
  faq JSONB DEFAULT '[]',
  urgency_text TEXT,
  guarantee_text TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#000000',
  whatsapp_number TEXT,
  facebook_pixel_id TEXT,
  google_analytics_id TEXT,
  custom_css TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug)
);

-- Ofertas da Landing Page (1, 3, 5 unidades)
CREATE TABLE public.landing_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  label TEXT NOT NULL, -- "1 unidade", "Kit 3 unidades", etc
  price_cents INT NOT NULL,
  original_price_cents INT, -- preço riscado
  discount_percentage INT,
  badge_text TEXT, -- "Mais vendido", "Melhor custo-benefício"
  is_highlighted BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- FASE 3: CARRINHO E CHECKOUT
-- =====================================================

-- Carrinhos (para abandono e recuperação)
CREATE TABLE public.ecommerce_carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storefront_id UUID REFERENCES public.tenant_storefronts(id) ON DELETE SET NULL,
  landing_page_id UUID REFERENCES public.landing_pages(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_name TEXT,
  subtotal_cents INT DEFAULT 0,
  discount_cents INT DEFAULT 0,
  shipping_cents INT DEFAULT 0,
  total_cents INT DEFAULT 0,
  coupon_code TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'abandoned', 'converted', 'expired')),
  abandoned_at TIMESTAMPTZ,
  recovery_email_sent_at TIMESTAMPTZ,
  recovery_whatsapp_sent_at TIMESTAMPTZ,
  converted_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens do carrinho
CREATE TABLE public.ecommerce_cart_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES public.ecommerce_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  unit_price_cents INT NOT NULL,
  total_cents INT NOT NULL,
  landing_offer_id UUID REFERENCES public.landing_offers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- FASE 5-6: CONTAS VIRTUAIS E SPLIT (MODELO GATEWAY)
-- =====================================================

-- Contas virtuais (tenants, afiliados, coprodutores)
CREATE TABLE public.virtual_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('tenant', 'affiliate', 'coproducer')),
  holder_name TEXT NOT NULL,
  holder_email TEXT NOT NULL,
  holder_document TEXT, -- CPF/CNPJ
  balance_cents INT DEFAULT 0,
  pending_balance_cents INT DEFAULT 0, -- saldo em período de liberação
  total_received_cents INT DEFAULT 0,
  total_withdrawn_cents INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dados bancários para saque
CREATE TABLE public.virtual_account_bank_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  virtual_account_id UUID NOT NULL REFERENCES public.virtual_accounts(id) ON DELETE CASCADE,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  agency TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings')),
  holder_name TEXT NOT NULL,
  holder_document TEXT NOT NULL,
  pix_key TEXT,
  pix_key_type TEXT CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random')),
  is_primary BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transações das contas virtuais
CREATE TABLE public.virtual_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  virtual_account_id UUID NOT NULL REFERENCES public.virtual_accounts(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'fee', 'withdrawal', 'refund', 'chargeback')),
  amount_cents INT NOT NULL,
  fee_cents INT DEFAULT 0,
  net_amount_cents INT NOT NULL,
  description TEXT,
  reference_id TEXT, -- ID externo (gateway)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'completed', 'cancelled')),
  release_at TIMESTAMPTZ, -- quando o saldo será liberado
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pedidos de saque
CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  virtual_account_id UUID NOT NULL REFERENCES public.virtual_accounts(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL,
  fee_cents INT DEFAULT 0,
  net_amount_cents INT NOT NULL,
  bank_data JSONB NOT NULL, -- snapshot dos dados bancários
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  transfer_proof_url TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Afiliados vinculados a produtos/storefronts
CREATE TABLE public.affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  virtual_account_id UUID NOT NULL REFERENCES public.virtual_accounts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  affiliate_code TEXT NOT NULL,
  commission_percentage NUMERIC(5,2) DEFAULT 10.00,
  commission_fixed_cents INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  total_sales INT DEFAULT 0,
  total_commission_cents INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, affiliate_code)
);

-- Coprodutores vinculados a produtos
CREATE TABLE public.coproducers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  virtual_account_id UUID NOT NULL REFERENCES public.virtual_accounts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  commission_percentage NUMERIC(5,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(virtual_account_id, product_id)
);

-- Split de cada venda (registro histórico)
CREATE TABLE public.sale_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  virtual_account_id UUID NOT NULL REFERENCES public.virtual_accounts(id) ON DELETE CASCADE,
  split_type TEXT NOT NULL CHECK (split_type IN ('tenant', 'affiliate', 'coproducer', 'platform')),
  gross_amount_cents INT NOT NULL,
  fee_cents INT DEFAULT 0,
  net_amount_cents INT NOT NULL,
  percentage NUMERIC(5,2),
  transaction_id UUID REFERENCES public.virtual_transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- FASE 4: GATEWAYS DE PAGAMENTO
-- =====================================================

-- Configuração de gateways por organização
CREATE TABLE public.payment_gateways (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  gateway_type TEXT NOT NULL CHECK (gateway_type IN ('stripe', 'pagarme', 'appmax', 'asaas')),
  name TEXT NOT NULL,
  api_key_encrypted TEXT, -- será criptografado
  api_secret_encrypted TEXT,
  webhook_secret TEXT,
  is_sandbox BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configurações da plataforma (super-admin)
CREATE TABLE public.platform_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir configurações padrão da plataforma
INSERT INTO public.platform_settings (setting_key, setting_value, description) VALUES
  ('withdrawal_rules', '{"min_amount_cents": 5000, "release_days": 14, "fee_percentage": 2.5, "fee_fixed_cents": 0}', 'Regras de saque'),
  ('platform_fees', '{"percentage": 5.0, "fixed_cents": 0}', 'Taxa da plataforma por venda'),
  ('affiliate_defaults', '{"commission_percentage": 10.0, "cookie_days": 30}', 'Configurações padrão de afiliados');

-- =====================================================
-- INDEXES PARA PERFORMANCE
-- =====================================================

CREATE INDEX idx_storefronts_org ON public.tenant_storefronts(organization_id);
CREATE INDEX idx_storefronts_slug ON public.tenant_storefronts(slug);
CREATE INDEX idx_storefront_products_storefront ON public.storefront_products(storefront_id);
CREATE INDEX idx_landing_pages_org ON public.landing_pages(organization_id);
CREATE INDEX idx_landing_pages_slug ON public.landing_pages(slug);
CREATE INDEX idx_carts_session ON public.ecommerce_carts(session_id);
CREATE INDEX idx_carts_status ON public.ecommerce_carts(status);
CREATE INDEX idx_carts_abandoned ON public.ecommerce_carts(status, abandoned_at) WHERE status = 'abandoned';
CREATE INDEX idx_virtual_accounts_type ON public.virtual_accounts(account_type);
CREATE INDEX idx_virtual_transactions_account ON public.virtual_transactions(virtual_account_id);
CREATE INDEX idx_virtual_transactions_status ON public.virtual_transactions(status);
CREATE INDEX idx_withdrawal_requests_status ON public.withdrawal_requests(status);
CREATE INDEX idx_affiliates_code ON public.affiliates(affiliate_code);
CREATE INDEX idx_sale_splits_sale ON public.sale_splits(sale_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.storefront_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_storefronts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_account_bank_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coproducers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Templates são públicos para leitura
CREATE POLICY "Templates são públicos" ON public.storefront_templates FOR SELECT USING (is_active = true);

-- Storefronts - tenant pode gerenciar os seus, público pode ver ativos
CREATE POLICY "Tenant gerencia storefronts" ON public.tenant_storefronts
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Storefronts ativos são públicos" ON public.storefront_domains FOR SELECT USING (true);

-- Produtos do storefront seguem o storefront
CREATE POLICY "Tenant gerencia produtos do storefront" ON public.storefront_products
  FOR ALL USING (storefront_id IN (
    SELECT id FROM public.tenant_storefronts WHERE organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  ));

-- Landing pages - tenant gerencia
CREATE POLICY "Tenant gerencia landing pages" ON public.landing_pages
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Ofertas seguem landing page
CREATE POLICY "Tenant gerencia ofertas" ON public.landing_offers
  FOR ALL USING (landing_page_id IN (
    SELECT id FROM public.landing_pages WHERE organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  ));

-- Carrinhos - público pode criar, tenant pode ver
CREATE POLICY "Público pode criar carrinho" ON public.ecommerce_carts FOR INSERT WITH CHECK (true);
CREATE POLICY "Público pode atualizar carrinho por sessão" ON public.ecommerce_carts FOR UPDATE USING (true);
CREATE POLICY "Tenant vê carrinhos" ON public.ecommerce_carts FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Público gerencia itens do carrinho" ON public.ecommerce_cart_items FOR ALL USING (true);

-- Contas virtuais - dono pode ver a sua
CREATE POLICY "Dono vê sua conta virtual" ON public.virtual_accounts FOR SELECT
  USING (user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Dono vê seus dados bancários" ON public.virtual_account_bank_data FOR ALL
  USING (virtual_account_id IN (SELECT id FROM public.virtual_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Dono vê suas transações" ON public.virtual_transactions FOR SELECT
  USING (virtual_account_id IN (SELECT id FROM public.virtual_accounts WHERE user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Dono gerencia saques" ON public.withdrawal_requests FOR ALL
  USING (virtual_account_id IN (SELECT id FROM public.virtual_accounts WHERE user_id = auth.uid()));

-- Afiliados - tenant gerencia
CREATE POLICY "Tenant gerencia afiliados" ON public.affiliates FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Coprodutores - tenant gerencia
CREATE POLICY "Tenant gerencia coprodutores" ON public.coproducers FOR ALL
  USING (product_id IN (SELECT id FROM public.lead_products WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())));

-- Splits - tenant pode ver
CREATE POLICY "Tenant vê splits" ON public.sale_splits FOR SELECT
  USING (sale_id IN (SELECT id FROM public.sales WHERE organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())));

-- Gateways - tenant gerencia
CREATE POLICY "Tenant gerencia gateways" ON public.payment_gateways FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Platform settings - apenas super admin
CREATE POLICY "Super admin gerencia settings" ON public.platform_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND email = 'morpheusadmin@gmail.com'));

-- =====================================================
-- TRIGGER PARA UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_updated_at_storefronts BEFORE UPDATE ON public.tenant_storefronts FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_landing_pages BEFORE UPDATE ON public.landing_pages FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_carts BEFORE UPDATE ON public.ecommerce_carts FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_virtual_accounts BEFORE UPDATE ON public.virtual_accounts FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_affiliates BEFORE UPDATE ON public.affiliates FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_templates BEFORE UPDATE ON public.storefront_templates FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();