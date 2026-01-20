-- Add AtomicPay payment provider support to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'stripe' CHECK (payment_provider IN ('stripe', 'atomicpay')),
ADD COLUMN IF NOT EXISTS atomicpay_monthly_url TEXT,
ADD COLUMN IF NOT EXISTS atomicpay_annual_url TEXT,
ADD COLUMN IF NOT EXISTS annual_price_cents INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN public.subscription_plans.payment_provider IS 'Payment gateway: stripe or atomicpay';
COMMENT ON COLUMN public.subscription_plans.atomicpay_monthly_url IS 'AtomicPay checkout URL for monthly subscription';
COMMENT ON COLUMN public.subscription_plans.atomicpay_annual_url IS 'AtomicPay checkout URL for annual subscription';
COMMENT ON COLUMN public.subscription_plans.annual_price_cents IS 'Annual subscription price in cents (for 40% discount calculation)';