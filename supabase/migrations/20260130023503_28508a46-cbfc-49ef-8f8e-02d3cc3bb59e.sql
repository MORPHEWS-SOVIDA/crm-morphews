-- Add mobile logo field to tenant_storefronts
ALTER TABLE public.tenant_storefronts
ADD COLUMN IF NOT EXISTS logo_mobile_url TEXT;