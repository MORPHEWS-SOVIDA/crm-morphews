-- Add unique constraint for organization + provider combination
-- This enables upsert functionality for toggling providers
ALTER TABLE public.organization_whatsapp_providers
ADD CONSTRAINT organization_whatsapp_providers_org_provider_key 
UNIQUE (organization_id, provider);