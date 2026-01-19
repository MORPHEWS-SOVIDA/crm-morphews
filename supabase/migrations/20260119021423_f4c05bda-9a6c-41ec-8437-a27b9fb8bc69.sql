-- Add requires_contact flag to organization_funnel_stages
-- This marks stages where leads need to be contacted by a seller (e.g., abandoned carts, new leads from integrations)
ALTER TABLE public.organization_funnel_stages 
ADD COLUMN IF NOT EXISTS requires_contact BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.organization_funnel_stages.requires_contact IS 'When true, leads in this stage are shown in "Clientes sem contato" section for sellers to claim';