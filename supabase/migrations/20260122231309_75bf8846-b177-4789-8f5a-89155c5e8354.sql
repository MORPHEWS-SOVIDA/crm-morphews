-- Add unique constraint for upsert to work
ALTER TABLE public.correios_enabled_services
ADD CONSTRAINT correios_enabled_services_org_code_unique UNIQUE (organization_id, service_code);