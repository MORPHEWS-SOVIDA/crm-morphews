-- Atualizar status de carrinho para nova lógica
ALTER TABLE public.ecommerce_carts 
  DROP CONSTRAINT IF EXISTS ecommerce_carts_status_check;

-- Adicionar novos valores de status possíveis
ALTER TABLE public.ecommerce_carts
  ADD CONSTRAINT ecommerce_carts_status_check 
  CHECK (status IN ('open', 'abandoned', 'payment_initiated', 'paid', 'converted', 'expired', 'active'));

-- Criar tabela de configurações de automação de e-commerce por organização
CREATE TABLE IF NOT EXISTS public.ecommerce_automation_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Configurações de criação de Lead
  lead_creation_trigger TEXT NOT NULL DEFAULT 'name_phone',
  lead_funnel_stage_id UUID,
  lead_default_assignment TEXT DEFAULT 'round_robin',
  lead_assigned_user_id UUID,
  
  -- Configurações de recuperação de carrinho abandonado
  cart_abandonment_minutes INTEGER NOT NULL DEFAULT 5,
  enable_whatsapp_recovery BOOLEAN NOT NULL DEFAULT true,
  whatsapp_recovery_delay_minutes INTEGER NOT NULL DEFAULT 30,
  enable_email_recovery BOOLEAN NOT NULL DEFAULT true,
  email_recovery_delay_minutes INTEGER NOT NULL DEFAULT 60,
  
  -- Configurações de notificação
  notify_team_on_cart BOOLEAN NOT NULL DEFAULT false,
  notify_team_on_payment BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.ecommerce_automation_config ENABLE ROW LEVEL SECURITY;

-- Policies para configuração de automação usando organization_members
CREATE POLICY "Admins can view org automation config"
  ON public.ecommerce_automation_config
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update org automation config"
  ON public.ecommerce_automation_config
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can insert org automation config"
  ON public.ecommerce_automation_config
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Criar tabela de vendas online com status completos
CREATE TABLE IF NOT EXISTS public.ecommerce_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cart_id UUID REFERENCES public.ecommerce_carts(id),
  sale_id UUID REFERENCES public.sales(id),
  lead_id UUID REFERENCES public.leads(id),
  
  -- Dados do pedido
  order_number TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_cpf TEXT,
  
  -- Endereço
  shipping_cep TEXT,
  shipping_street TEXT,
  shipping_number TEXT,
  shipping_complement TEXT,
  shipping_neighborhood TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  
  -- Valores
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  
  -- Rastreamento
  tracking_code TEXT,
  carrier TEXT,
  
  -- Status principal
  status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN (
    'awaiting_payment',
    'processing',
    'approved',
    'separating',
    'shipped',
    'delivered',
    'canceled',
    'refunded',
    'partial_refund',
    'refund_pending',
    'refund_requested',
    'chargeback',
    'chargeback_disputed',
    'blacklisted',
    'frustrated',
    'trial',
    'awaiting_confirmation'
  )),
  
  -- Origem
  source TEXT DEFAULT 'storefront' CHECK (source IN ('storefront', 'landing_page', 'manual', 'api')),
  storefront_id UUID REFERENCES public.tenant_storefronts(id),
  landing_page_id UUID REFERENCES public.landing_pages(id),
  
  -- Atribuição
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  fbclid TEXT,
  gclid TEXT,
  ttclid TEXT,
  
  -- Afiliado
  affiliate_id UUID REFERENCES public.affiliates(id),
  affiliate_commission_cents INTEGER DEFAULT 0,
  
  -- Pagamento
  payment_method TEXT,
  payment_gateway TEXT,
  payment_transaction_id TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  
  -- Notas internas
  internal_notes TEXT
);

-- Sequence para order_number
CREATE SEQUENCE IF NOT EXISTS ecommerce_order_seq;

-- Function para gerar order_number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'PED-' || LPAD(nextval('ecommerce_order_seq')::TEXT, 8, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_order_number ON public.ecommerce_orders;
CREATE TRIGGER set_order_number
  BEFORE INSERT ON public.ecommerce_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_org ON public.ecommerce_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_status ON public.ecommerce_orders(status);
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_lead ON public.ecommerce_orders(lead_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_created ON public.ecommerce_orders(created_at DESC);

-- Enable RLS
ALTER TABLE public.ecommerce_orders ENABLE ROW LEVEL SECURITY;

-- Policies para pedidos usando organization_members
CREATE POLICY "Users can view org orders"
  ON public.ecommerce_orders
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update org orders"
  ON public.ecommerce_orders
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner', 'manager')
    )
  );

CREATE POLICY "Users can insert orders"
  ON public.ecommerce_orders
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Adicionar updated_at trigger
DROP TRIGGER IF EXISTS update_ecommerce_orders_updated_at ON public.ecommerce_orders;
CREATE TRIGGER update_ecommerce_orders_updated_at
  BEFORE UPDATE ON public.ecommerce_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_ecommerce_automation_config_updated_at ON public.ecommerce_automation_config;
CREATE TRIGGER update_ecommerce_automation_config_updated_at
  BEFORE UPDATE ON public.ecommerce_automation_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de itens do pedido
CREATE TABLE IF NOT EXISTS public.ecommerce_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.ecommerce_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.lead_products(id),
  product_name TEXT NOT NULL,
  product_image_url TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS para itens
ALTER TABLE public.ecommerce_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view order items"
  ON public.ecommerce_order_items
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM ecommerce_orders WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert order items"
  ON public.ecommerce_order_items
  FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT id FROM ecommerce_orders WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );