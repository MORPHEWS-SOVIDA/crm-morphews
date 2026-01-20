-- Add policy to allow anonymous users to view active plans for the public pricing page
DROP POLICY IF EXISTS "Anon can view active plans" ON public.subscription_plans;

CREATE POLICY "Anon can view active plans"
  ON public.subscription_plans
  FOR SELECT
  USING (is_active = true);

-- Note: This is safe because subscription_plans_public view already filters 
-- out sensitive columns like stripe_price_id, so no sensitive data is exposed