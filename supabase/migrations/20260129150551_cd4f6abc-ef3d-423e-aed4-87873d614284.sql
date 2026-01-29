-- Adicionar coluna para configurar etapa pós-venda do Add Receptivo
-- Quando uma venda é finalizada no Add Receptivo, o lead vai para esta etapa
-- e a etapa pode ter um follow-up automático vinculado (default_followup_reason_id)

ALTER TABLE public.ecommerce_automation_config
ADD COLUMN IF NOT EXISTS receptivo_sale_funnel_stage_id UUID REFERENCES public.organization_funnel_stages(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.ecommerce_automation_config.receptivo_sale_funnel_stage_id IS 'Etapa do funil para mover o lead quando uma venda é criada no Add Receptivo. Se a etapa tiver um follow-up padrão configurado, a cadência será iniciada automaticamente.';