
-- Drop the current INSERT policy
DROP POLICY IF EXISTS "Users can insert leads in their org" ON public.leads;

-- Create a new INSERT policy that checks if user is a member of ANY org
-- and the org they're inserting to matches their membership
CREATE POLICY "Users can insert leads in their org" 
ON public.leads 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.user_id = auth.uid()
    AND organization_members.organization_id = leads.organization_id
  )
);
