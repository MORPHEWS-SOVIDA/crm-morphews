-- Add UPDATE and INSERT policies for master admins on subscription_plans
CREATE POLICY "Master admins can update plans"
ON public.subscription_plans
FOR UPDATE
USING (is_master_admin(auth.uid()))
WITH CHECK (is_master_admin(auth.uid()));

CREATE POLICY "Master admins can insert plans"
ON public.subscription_plans
FOR INSERT
WITH CHECK (is_master_admin(auth.uid()));

CREATE POLICY "Master admins can delete plans"
ON public.subscription_plans
FOR DELETE
USING (is_master_admin(auth.uid()));