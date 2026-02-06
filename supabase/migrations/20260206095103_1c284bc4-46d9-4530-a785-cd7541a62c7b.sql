-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Super admin gerencia settings" ON platform_settings;

-- Create new policy using the existing is_super_admin function
CREATE POLICY "Super admin gerencia settings" 
ON platform_settings 
FOR ALL 
USING (
  public.is_super_admin(auth.uid()) 
  OR (auth.jwt() ->> 'email') = 'thiago.morphews@gmail.com'
)
WITH CHECK (
  public.is_super_admin(auth.uid()) 
  OR (auth.jwt() ->> 'email') = 'thiago.morphews@gmail.com'
);