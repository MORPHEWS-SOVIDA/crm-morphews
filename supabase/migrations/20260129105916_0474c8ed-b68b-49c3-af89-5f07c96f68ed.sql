-- =============================================
-- WHITE LABEL SYSTEM FOR IMPLEMENTERS
-- Modelo Híbrido: Mensalidade + Comissões
-- =============================================

-- 1. Tabela de configuração White Label
CREATE TABLE IF NOT EXISTS public.white_label_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  implementer_id UUID NOT NULL REFERENCES public.implementers(id) ON DELETE CASCADE,
  
  -- Branding
  brand_name TEXT NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#8B5CF6',
  secondary_color TEXT DEFAULT '#ffffff',
  
  -- URLs
  sales_page_slug TEXT UNIQUE,
  custom_domain TEXT,
  
  -- E-mail Branding
  email_from_name TEXT,
  email_logo_url TEXT,
  support_email TEXT,
  support_whatsapp TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(implementer_id)
);

-- 2. Flag no plano para permitir White Label
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS allows_white_label BOOLEAN DEFAULT false;

-- 3. Flag no implementador para indicar se é White Label
ALTER TABLE public.implementers
ADD COLUMN IF NOT EXISTS is_white_label BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS white_label_config_id UUID REFERENCES public.white_label_configs(id);

-- 4. Vincular clientes ao White Label
ALTER TABLE public.implementer_sales
ADD COLUMN IF NOT EXISTS white_label_config_id UUID REFERENCES public.white_label_configs(id);

-- 5. RLS Policies
ALTER TABLE public.white_label_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Implementers can manage own white label config"
ON public.white_label_configs
FOR ALL
USING (
  implementer_id IN (
    SELECT id FROM public.implementers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Super admins can manage all white label configs"
ON public.white_label_configs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Public can read active white label configs by slug"
ON public.white_label_configs
FOR SELECT
USING (is_active = true);

-- 6. Índices
CREATE INDEX idx_white_label_configs_slug ON public.white_label_configs(sales_page_slug);
CREATE INDEX idx_white_label_configs_implementer ON public.white_label_configs(implementer_id);

-- 7. Trigger para updated_at
CREATE TRIGGER update_white_label_configs_updated_at
BEFORE UPDATE ON public.white_label_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Comentários
COMMENT ON TABLE public.white_label_configs IS 'Configurações de White Label para implementadores com marca própria';
COMMENT ON COLUMN public.white_label_configs.sales_page_slug IS 'Slug para /pv2/:slug - página de vendas personalizada';
COMMENT ON COLUMN public.white_label_configs.brand_name IS 'Nome da marca do revendedor (ex: ATOMICsales)';
COMMENT ON COLUMN public.subscription_plans.allows_white_label IS 'Se true, permite configurar White Label';