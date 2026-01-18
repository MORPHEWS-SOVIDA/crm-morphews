-- Create a public-safe view for subscription plans that hides sensitive business data
-- Sensitive: stripe_price_id, stripe_extra_users_price_id, stripe_extra_whatsapp_instances_price_id, 
-- stripe_extra_energy_price_id (Stripe integration details)
-- We expose only user-facing fields needed for the pricing page

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
  created_at
FROM public.subscription_plans
WHERE is_active = true;

-- Grant SELECT on this view to everyone (including anon) since it only exposes public pricing info
GRANT SELECT ON public.subscription_plans_public TO anon, authenticated;