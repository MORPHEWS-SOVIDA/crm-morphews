-- Harden subscription_plans against public data exposure
-- Remove any permissive SELECT policies that apply to anon/public and keep access restricted.

-- Ensure RLS is enabled
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Drop known permissive/public policies (names taken from historical migrations)
DROP POLICY IF EXISTS "Anyone can view active plans or master admin sees all" ON public.subscription_plans;
DROP POLICY IF EXISTS "Anyone can view subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;

-- NOTE: We intentionally keep existing authenticated-only policies (e.g. "Users can view active subscription plans")
-- and master-admin CRUD policies that are already in place.
