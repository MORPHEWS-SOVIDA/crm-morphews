-- Add default funnel stage configuration per entry source to organizations table
-- This allows tenants to configure which stage leads should be assigned based on how they enter the system

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS default_stage_new_lead uuid REFERENCES public.organization_funnel_stages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS default_stage_whatsapp uuid REFERENCES public.organization_funnel_stages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS default_stage_receptivo uuid REFERENCES public.organization_funnel_stages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS default_stage_fallback uuid REFERENCES public.organization_funnel_stages(id) ON DELETE SET NULL;

-- Add comments for clarity
COMMENT ON COLUMN public.organizations.default_stage_new_lead IS 'Etapa padrão para leads criados manualmente via /leads/new';
COMMENT ON COLUMN public.organizations.default_stage_whatsapp IS 'Etapa padrão para leads criados via WhatsApp Chat';
COMMENT ON COLUMN public.organizations.default_stage_receptivo IS 'Etapa padrão para leads criados via Add Receptivo';
COMMENT ON COLUMN public.organizations.default_stage_fallback IS 'Etapa padrão geral (fallback) quando nenhuma específica está configurada';