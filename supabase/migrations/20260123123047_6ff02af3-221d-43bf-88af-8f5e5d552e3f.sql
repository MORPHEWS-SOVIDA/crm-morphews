-- =====================================================
-- REESTRUTURAÇÃO DO CADASTRO DE PRODUTOS
-- =====================================================

-- 1. Adicionar campos fixos de 1 UNIDADE na tabela lead_products
-- Esses campos são OBRIGATÓRIOS para todos os produtos (exceto manipulados)
ALTER TABLE public.lead_products
ADD COLUMN IF NOT EXISTS base_price_cents integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_commission_percentage numeric(5,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS base_use_default_commission boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS base_points integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_usage_period_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_sales_hack text DEFAULT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.lead_products.base_price_cents IS 'Preço fixo de 1 unidade (em centavos) - obrigatório para produtos com preço';
COMMENT ON COLUMN public.lead_products.base_commission_percentage IS 'Comissão personalizada para 1 unidade (se não usar padrão)';
COMMENT ON COLUMN public.lead_products.base_use_default_commission IS 'Se true, usa comissão padrão da empresa para 1 unidade';
COMMENT ON COLUMN public.lead_products.base_points IS 'Pontos de campanha ao vender 1 unidade';
COMMENT ON COLUMN public.lead_products.base_usage_period_days IS 'Período de uso/tratamento em dias para 1 unidade';
COMMENT ON COLUMN public.lead_products.base_sales_hack IS 'Dicas de venda para 1 unidade';

-- 2. Criar tabela de COMBOS (vendas casadas de múltiplos produtos)
CREATE TABLE IF NOT EXISTS public.product_combos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sku text,
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Criar tabela de itens do combo (quais produtos compõem o combo)
CREATE TABLE IF NOT EXISTS public.product_combo_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  combo_id uuid NOT NULL REFERENCES public.product_combos(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(combo_id, product_id)
);

-- 4. Criar tabela de preços do combo (similar aos kits, pode ter múltiplos)
CREATE TABLE IF NOT EXISTS public.product_combo_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  combo_id uuid NOT NULL REFERENCES public.product_combos(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  multiplier integer NOT NULL DEFAULT 1, -- Combo x1, x2, x3...
  
  -- Preço Normal (calculado automaticamente a partir dos produtos, mas pode ser sobrescrito)
  regular_price_cents integer NOT NULL DEFAULT 0,
  regular_use_default_commission boolean DEFAULT true,
  regular_custom_commission numeric(5,2) DEFAULT NULL,
  
  -- Preço Promocional
  promotional_price_cents integer,
  promotional_use_default_commission boolean DEFAULT true,
  promotional_custom_commission numeric(5,2) DEFAULT NULL,
  
  -- Preço Promocional 2
  promotional_price_2_cents integer,
  promotional_2_use_default_commission boolean DEFAULT true,
  promotional_2_custom_commission numeric(5,2) DEFAULT NULL,
  
  -- Preço Mínimo
  minimum_price_cents integer,
  minimum_use_default_commission boolean DEFAULT true,
  minimum_custom_commission numeric(5,2) DEFAULT NULL,
  
  -- Extras
  points integer DEFAULT 0,
  sales_hack text,
  position integer NOT NULL DEFAULT 0,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  UNIQUE(combo_id, multiplier)
);

-- 5. Habilitar RLS em todas as tabelas
ALTER TABLE public.product_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_combo_prices ENABLE ROW LEVEL SECURITY;

-- 6. Policies para product_combos
CREATE POLICY "Users can view combos from their organization"
  ON public.product_combos FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create combos in their organization"
  ON public.product_combos FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update combos in their organization"
  ON public.product_combos FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete combos in their organization"
  ON public.product_combos FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- 7. Policies para product_combo_items
CREATE POLICY "Users can view combo items"
  ON public.product_combo_items FOR SELECT
  USING (
    combo_id IN (
      SELECT id FROM public.product_combos WHERE organization_id IN (
        SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage combo items"
  ON public.product_combo_items FOR ALL
  USING (
    combo_id IN (
      SELECT id FROM public.product_combos WHERE organization_id IN (
        SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- 8. Policies para product_combo_prices
CREATE POLICY "Users can view combo prices from their organization"
  ON public.product_combo_prices FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage combo prices in their organization"
  ON public.product_combo_prices FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- 9. Índices para performance
CREATE INDEX IF NOT EXISTS idx_product_combos_org ON public.product_combos(organization_id);
CREATE INDEX IF NOT EXISTS idx_product_combo_items_combo ON public.product_combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_product_combo_items_product ON public.product_combo_items(product_id);
CREATE INDEX IF NOT EXISTS idx_product_combo_prices_combo ON public.product_combo_prices(combo_id);

-- 10. Trigger para updated_at
CREATE TRIGGER update_product_combos_updated_at
  BEFORE UPDATE ON public.product_combos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_combo_prices_updated_at
  BEFORE UPDATE ON public.product_combo_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();