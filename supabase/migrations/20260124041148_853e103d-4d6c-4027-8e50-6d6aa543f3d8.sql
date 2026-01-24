-- Create function to check if user is admin role
CREATE OR REPLACE FUNCTION public.has_admin_role(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = $1 AND ur.role = 'admin'
  );
$$;

-- Create policy for admins to manage platform gateway config
CREATE POLICY "Admins can manage platform gateways"
ON public.platform_gateway_config
FOR ALL
USING (public.has_admin_role(auth.uid()))
WITH CHECK (public.has_admin_role(auth.uid()));