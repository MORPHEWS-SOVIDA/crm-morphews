-- Adicionar coluna de follow-up automático preferencial para cada etapa do funil
-- Quando um lead entra nessa etapa, esse é o follow-up sugerido por padrão

ALTER TABLE public.organization_funnel_stages
ADD COLUMN IF NOT EXISTS default_followup_reason_id UUID REFERENCES public.non_purchase_reasons(id) ON DELETE SET NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.organization_funnel_stages.default_followup_reason_id IS 'ID do motivo de não-compra/follow-up automático sugerido quando um lead entra nesta etapa';