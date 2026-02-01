-- =====================================================
-- WHITE LABEL SUB-FRANCHISE SYSTEM
-- Planos customizados, clientes e gestão descentralizada
-- =====================================================

-- 1. Tabela de planos customizados do White Label
CREATE TABLE IF NOT EXISTS public.white_label_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  white_label_config_id UUID NOT NULL REFERENCES white_label_configs(id) ON DELETE CASCADE,
  
  -- Identificação
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL,
  
  -- Preços (o WL define livremente)
  price_cents INTEGER NOT NULL DEFAULT 0,
  setup_fee_cents INTEGER DEFAULT 0,
  
  -- Limites e Features (igual subscription_plans)
  max_users INTEGER DEFAULT 1,
  max_leads INTEGER,
  max_whatsapp_instances INTEGER DEFAULT 1,
  max_energy_per_month INTEGER DEFAULT 5000,
  max_ecommerce_products INTEGER DEFAULT 0,
  max_storefronts INTEGER DEFAULT 0,
  
  -- Features booleanas
  has_ai_bots BOOLEAN DEFAULT false,
  has_whatsapp BOOLEAN DEFAULT true,
  has_email_marketing BOOLEAN DEFAULT false,
  has_ecommerce BOOLEAN DEFAULT false,
  has_erp BOOLEAN DEFAULT false,
  has_tracking BOOLEAN DEFAULT false,
  has_nfe BOOLEAN DEFAULT false,
  
  -- Custo para a plataforma (quanto a Morphews cobra do WL por este plano)
  platform_cost_cents INTEGER DEFAULT 0,
  platform_percentage NUMERIC(5,2) DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true, -- visível na página de planos do WL
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(white_label_config_id, slug)
);

-- 2. Tabela para rastrear clientes do White Label
-- Evolução da implementer_sales para suportar gestão completa
CREATE TABLE IF NOT EXISTS public.white_label_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  white_label_config_id UUID NOT NULL REFERENCES white_label_configs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Plano contratado (do WL)
  white_label_plan_id UUID REFERENCES white_label_plans(id),
  
  -- Dados financeiros
  contracted_price_cents INTEGER,
  setup_fee_paid_cents INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled', 'trial')),
  trial_ends_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  activated_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  UNIQUE(white_label_config_id, organization_id)
);

-- 3. Adicionar campos à white_label_configs para domínio e configurações avançadas
ALTER TABLE white_label_configs
ADD COLUMN IF NOT EXISTS app_domain TEXT, -- ex: app.atomicsales.com.br
ADD COLUMN IF NOT EXISTS checkout_domain TEXT, -- ex: pay.atomicsales.com.br
ADD COLUMN IF NOT EXISTS support_phone TEXT,
ADD COLUMN IF NOT EXISTS terms_url TEXT,
ADD COLUMN IF NOT EXISTS privacy_url TEXT,
ADD COLUMN IF NOT EXISTS login_background_url TEXT,
ADD COLUMN IF NOT EXISTS dashboard_welcome_message TEXT;

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_white_label_plans_config_id ON white_label_plans(white_label_config_id);
CREATE INDEX IF NOT EXISTS idx_white_label_plans_active ON white_label_plans(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_white_label_customers_config_id ON white_label_customers(white_label_config_id);
CREATE INDEX IF NOT EXISTS idx_white_label_customers_org_id ON white_label_customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_white_label_customers_status ON white_label_customers(status);

-- 5. RLS Policies

-- White Label Plans: WL owner pode CRUD seus próprios planos
ALTER TABLE white_label_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WL owners can view their plans"
ON white_label_plans FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM white_label_configs wlc
    JOIN implementers imp ON imp.white_label_config_id = wlc.id
    WHERE wlc.id = white_label_plans.white_label_config_id
    AND imp.user_id = auth.uid()
  )
  OR
  -- Ou é admin master
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "WL owners can create plans"
ON white_label_plans FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM white_label_configs wlc
    JOIN implementers imp ON imp.white_label_config_id = wlc.id
    WHERE wlc.id = white_label_plans.white_label_config_id
    AND imp.user_id = auth.uid()
  )
);

CREATE POLICY "WL owners can update their plans"
ON white_label_plans FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM white_label_configs wlc
    JOIN implementers imp ON imp.white_label_config_id = wlc.id
    WHERE wlc.id = white_label_plans.white_label_config_id
    AND imp.user_id = auth.uid()
  )
);

CREATE POLICY "WL owners can delete their plans"
ON white_label_plans FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM white_label_configs wlc
    JOIN implementers imp ON imp.white_label_config_id = wlc.id
    WHERE wlc.id = white_label_plans.white_label_config_id
    AND imp.user_id = auth.uid()
  )
);

-- Public access para planos ativos (para página de vendas)
CREATE POLICY "Public can view active public plans"
ON white_label_plans FOR SELECT
USING (is_active = true AND is_public = true);

-- White Label Customers: WL owner pode gerenciar seus clientes
ALTER TABLE white_label_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WL owners can view their customers"
ON white_label_customers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM white_label_configs wlc
    JOIN implementers imp ON imp.white_label_config_id = wlc.id
    WHERE wlc.id = white_label_customers.white_label_config_id
    AND imp.user_id = auth.uid()
  )
  OR
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "WL owners can create customers"
ON white_label_customers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM white_label_configs wlc
    JOIN implementers imp ON imp.white_label_config_id = wlc.id
    WHERE wlc.id = white_label_customers.white_label_config_id
    AND imp.user_id = auth.uid()
  )
);

CREATE POLICY "WL owners can update their customers"
ON white_label_customers FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM white_label_configs wlc
    JOIN implementers imp ON imp.white_label_config_id = wlc.id
    WHERE wlc.id = white_label_customers.white_label_config_id
    AND imp.user_id = auth.uid()
  )
);

-- 6. Função para buscar o WL config do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_white_label_config()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wlc.id
  FROM white_label_configs wlc
  JOIN implementers imp ON imp.white_label_config_id = wlc.id
  WHERE imp.user_id = auth.uid()
  AND wlc.is_active = true
  LIMIT 1;
$$;

-- 7. Função para verificar se usuário é WL owner
CREATE OR REPLACE FUNCTION public.is_white_label_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM implementers imp
    JOIN white_label_configs wlc ON wlc.id = imp.white_label_config_id
    WHERE imp.user_id = _user_id
    AND imp.is_white_label = true
    AND wlc.is_active = true
  );
$$;