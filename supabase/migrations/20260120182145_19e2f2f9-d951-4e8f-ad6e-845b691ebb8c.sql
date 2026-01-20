-- Add is_visible_on_site column to subscription_plans for granular visibility control
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS is_visible_on_site boolean DEFAULT true;

-- Update the public view to include the visibility flag and filter by it
DROP VIEW IF EXISTS public.subscription_plans_public;

CREATE VIEW public.subscription_plans_public
WITH (security_invoker = on) AS
SELECT
  id,
  name,
  price_cents,
  max_users,
  max_leads,
  extra_user_price_cents,
  extra_instance_price_cents,
  extra_energy_price_cents,
  included_whatsapp_instances,
  monthly_energy,
  is_active,
  is_visible_on_site,
  created_at
FROM public.subscription_plans
WHERE is_active = true AND is_visible_on_site = true;