-- Tabela para armazenar rejeições de kits pelos vendedores
CREATE TABLE public.lead_kit_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  kit_id UUID NOT NULL REFERENCES public.product_price_kits(id) ON DELETE CASCADE,
  rejected_by UUID NOT NULL,
  rejection_reason TEXT NOT NULL,
  kit_quantity INTEGER NOT NULL,
  kit_price_cents INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index para consultas por lead
CREATE INDEX idx_lead_kit_rejections_lead ON public.lead_kit_rejections(lead_id);

-- Index para consultas por produto
CREATE INDEX idx_lead_kit_rejections_product ON public.lead_kit_rejections(product_id);

-- Habilitar RLS
ALTER TABLE public.lead_kit_rejections ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view kit rejections in their organization"
  ON public.lead_kit_rejections
  FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert kit rejections in their organization"
  ON public.lead_kit_rejections
  FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Comentário na tabela
COMMENT ON TABLE public.lead_kit_rejections IS 'Histórico de rejeições de kits de preço pelos vendedores durante o processo de venda';