-- Allow master admin to insert organizations
CREATE POLICY "Master admin can insert organizations"
ON public.organizations
FOR INSERT
WITH CHECK (is_master_admin(auth.uid()));

-- Allow master admin to insert subscriptions
CREATE POLICY "Master admin can insert subscriptions"
ON public.subscriptions
FOR INSERT
WITH CHECK (is_master_admin(auth.uid()));

-- Allow master admin to insert organization members
CREATE POLICY "Master admin can insert organization members"
ON public.organization_members
FOR INSERT
WITH CHECK (is_master_admin(auth.uid()));

-- Allow master admin to update profiles (to assign organization)
CREATE POLICY "Master admin can update all profiles"
ON public.profiles
FOR UPDATE
USING (is_master_admin(auth.uid()));