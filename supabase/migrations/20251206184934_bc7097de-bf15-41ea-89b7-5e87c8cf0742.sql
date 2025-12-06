
-- Drop the problematic INSERT policy
DROP POLICY IF EXISTS "Users can insert leads in their org" ON public.leads;

-- Create a simpler INSERT policy that uses the security definer function
CREATE POLICY "Users can insert leads in their org" 
ON public.leads 
FOR INSERT 
TO authenticated
WITH CHECK (
  public.user_can_insert_to_org(auth.uid(), organization_id)
);
