-- Add new columns to subscription_plans for WhatsApp instances and Energy pricing
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS included_whatsapp_instances integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_instance_price_cents integer NOT NULL DEFAULT 4900,
  ADD COLUMN IF NOT EXISTS extra_energy_price_cents integer NOT NULL DEFAULT 500;

-- Add comment for documentation
COMMENT ON COLUMN subscription_plans.included_whatsapp_instances IS 'Number of WhatsApp instances included in this plan';
COMMENT ON COLUMN subscription_plans.extra_instance_price_cents IS 'Price in cents for each extra WhatsApp instance per month';
COMMENT ON COLUMN subscription_plans.extra_energy_price_cents IS 'Price in cents for each 1000 extra AI energy credits';