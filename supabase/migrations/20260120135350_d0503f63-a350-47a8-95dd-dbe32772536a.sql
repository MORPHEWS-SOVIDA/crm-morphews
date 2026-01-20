-- Drop the global unique constraint on name (causes cross-org conflicts)
ALTER TABLE public.lead_products DROP CONSTRAINT IF EXISTS lead_products_name_key;

-- Create a unique constraint scoped to each organization
ALTER TABLE public.lead_products ADD CONSTRAINT lead_products_organization_name_key UNIQUE (organization_id, name);