-- Add Pagar.me plan ID column to subscription_plans for recurring billing
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS pagarme_plan_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.subscription_plans.pagarme_plan_id IS 'Pagar.me V5 Plan ID for recurring subscriptions';