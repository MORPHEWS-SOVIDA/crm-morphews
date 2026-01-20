-- Drop and recreate view with AtomicPay fields
DROP VIEW IF EXISTS public.subscription_plans_public;

CREATE VIEW public.subscription_plans_public AS
SELECT
  id,
  name,
  price_cents,
  annual_price_cents,
  max_users,
  max_leads,
  extra_user_price_cents,
  extra_instance_price_cents,
  extra_energy_price_cents,
  included_whatsapp_instances,
  monthly_energy,
  is_active,
  is_visible_on_site,
  payment_provider,
  atomicpay_monthly_url,
  atomicpay_annual_url,
  created_at
FROM public.subscription_plans
WHERE is_active = true
  AND is_visible_on_site = true;

-- Re-grant anonymous access
GRANT SELECT ON public.subscription_plans_public TO anon;