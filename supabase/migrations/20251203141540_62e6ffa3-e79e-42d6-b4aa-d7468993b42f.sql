-- Create function to check if user is master admin
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
    AND email = 'thiago.morphews@gmail.com'
  )
$$;

-- Add policies for master admin to view all organizations
CREATE POLICY "Master admin can view all organizations"
ON public.organizations
FOR SELECT
USING (is_master_admin(auth.uid()));

-- Add policies for master admin to view all subscriptions
CREATE POLICY "Master admin can view all subscriptions"
ON public.subscriptions
FOR SELECT
USING (is_master_admin(auth.uid()));

-- Add policies for master admin to view all organization members
CREATE POLICY "Master admin can view all organization members"
ON public.organization_members
FOR SELECT
USING (is_master_admin(auth.uid()));

-- Add policy for master admin to view all subscription plans (including inactive)
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view active plans or master admin sees all"
ON public.subscription_plans
FOR SELECT
USING (is_active = true OR is_master_admin(auth.uid()));