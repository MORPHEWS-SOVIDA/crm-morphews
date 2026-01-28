-- Add Super Admin policies for organizations (needed for JOINs in dashboard)
CREATE POLICY "Super admin can view all organizations" 
ON public.organizations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Add Super Admin policy for virtual_accounts (needed for split details)
CREATE POLICY "Super admin can view all virtual accounts" 
ON public.virtual_accounts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Add Super Admin policy for tenant_storefronts (needed for order details)
CREATE POLICY "Super admin can view all storefronts" 
ON public.tenant_storefronts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);