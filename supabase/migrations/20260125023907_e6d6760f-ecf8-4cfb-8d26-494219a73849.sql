-- TABELA PRINCIPAL: STANDALONE CHECKOUTS
CREATE TABLE public.standalone_checkouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Identificação
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  
  -- Configuração de layout
  checkout_type TEXT NOT NULL DEFAULT 'one_step' CHECK (checkout_type IN ('one_step', 'two_step', 'three_step')),
  
  -- Elementos visuais (cada um pode ser ativado/desativado)
  elements JSONB NOT NULL DEFAULT '{
    "countdown": {
      "enabled": false,
      "duration_minutes": 15,
      "text": "Oferta expira em:",
      "end_action": "hide"
    },
    "top_banner": {
      "enabled": false,
      "text": "🔥 Frete Grátis para todo Brasil!",
      "background_color": "#10b981",
      "text_color": "#ffffff"
    },
    "testimonials": {
      "enabled": false,
      "items": []
    },
    "guarantee": {
      "enabled": false,
      "days": 7,
      "text": "Garantia incondicional de 7 dias"
    },
    "trust_badges": {
      "enabled": true,
      "show_secure_payment": true,
      "show_money_back": true,
      "show_support": true
    }
  }'::jsonb,
  
  -- Order Bump
  order_bump_enabled BOOLEAN DEFAULT false,
  order_bump_product_id UUID REFERENCES public.lead_products(id) ON DELETE SET NULL,
  order_bump_discount_percent NUMERIC(5,2) DEFAULT 0,
  order_bump_headline TEXT DEFAULT 'Aproveite essa oferta exclusiva!',
  order_bump_description TEXT,
  
  -- Configurações de pagamento
  payment_methods TEXT[] NOT NULL DEFAULT ARRAY['pix', 'credit_card', 'boleto'],
  pix_discount_percent NUMERIC(5,2) DEFAULT 0,
  
  -- Estilo visual
  theme JSONB NOT NULL DEFAULT '{
    "primary_color": "#8b5cf6",
    "background_color": "#ffffff",
    "text_color": "#1f2937",
    "font_family": "Inter",
    "border_radius": "8px",
    "button_style": "solid"
  }'::jsonb,
  
  -- SEO e tracking
  meta_title TEXT,
  meta_description TEXT,
  facebook_pixel_id TEXT,
  google_analytics_id TEXT,
  tiktok_pixel_id TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraint de unicidade para slug por organização
  CONSTRAINT unique_checkout_slug_per_org UNIQUE (organization_id, slug)
);

-- Índices
CREATE INDEX idx_standalone_checkouts_org ON public.standalone_checkouts(organization_id);
CREATE INDEX idx_standalone_checkouts_slug ON public.standalone_checkouts(slug);
CREATE INDEX idx_standalone_checkouts_product ON public.standalone_checkouts(product_id);

-- Enable RLS
ALTER TABLE public.standalone_checkouts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their org checkouts"
ON public.standalone_checkouts
FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can manage their org checkouts"
ON public.standalone_checkouts
FOR ALL
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

-- Política pública para visualização do checkout (acesso anon para clientes)
CREATE POLICY "Public can view active checkouts"
ON public.standalone_checkouts
FOR SELECT
USING (is_active = true);

-- Trigger de updated_at
CREATE TRIGGER update_standalone_checkouts_updated_at
BEFORE UPDATE ON public.standalone_checkouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de depoimentos para checkouts
CREATE TABLE public.checkout_testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkout_id UUID NOT NULL REFERENCES public.standalone_checkouts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Dados do depoimento
  author_name TEXT NOT NULL,
  author_photo_url TEXT,
  author_location TEXT,
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL,
  
  -- Ordenação
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_checkout_testimonials_checkout ON public.checkout_testimonials(checkout_id);

-- Enable RLS
ALTER TABLE public.checkout_testimonials ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can manage their org testimonials"
ON public.checkout_testimonials
FOR ALL
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Public can view testimonials of active checkouts"
ON public.checkout_testimonials
FOR SELECT
USING (checkout_id IN (
  SELECT id FROM public.standalone_checkouts WHERE is_active = true
));

-- Comentário
COMMENT ON TABLE public.standalone_checkouts IS 'Checkouts independentes (sem loja/LP) para venda direta via link';