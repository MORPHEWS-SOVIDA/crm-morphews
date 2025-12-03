-- Add UPDATE policy for master admin on organizations
CREATE POLICY "Master admin can update all organizations" 
ON public.organizations 
FOR UPDATE 
USING (is_master_admin(auth.uid()));

-- Add UPDATE policy for master admin on subscriptions
CREATE POLICY "Master admin can update all subscriptions" 
ON public.subscriptions 
FOR UPDATE 
USING (is_master_admin(auth.uid()));