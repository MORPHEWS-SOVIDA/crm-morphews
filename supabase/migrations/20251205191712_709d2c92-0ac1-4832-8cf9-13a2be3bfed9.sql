-- Fix discount_coupons RLS: require authentication to view coupons
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.discount_coupons;

CREATE POLICY "Authenticated users can view active coupons"
ON public.discount_coupons
FOR SELECT
TO authenticated
USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

-- Fix user_onboarding_progress RLS: remove overly permissive policy
DROP POLICY IF EXISTS "System can manage onboarding progress" ON public.user_onboarding_progress;

-- Create proper policies for user_onboarding_progress
CREATE POLICY "Users can insert their own onboarding progress"
ON public.user_onboarding_progress
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own onboarding progress"
ON public.user_onboarding_progress
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());