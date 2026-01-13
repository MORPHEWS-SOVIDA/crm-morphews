-- Add columns for tracking extra subscription items
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS extra_whatsapp_instances integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_energy_packs integer NOT NULL DEFAULT 0;

-- Add Stripe price ID columns for add-on products
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_extra_users_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_extra_whatsapp_instances_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_extra_energy_price_id text;