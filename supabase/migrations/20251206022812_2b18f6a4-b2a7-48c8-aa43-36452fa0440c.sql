-- Drop existing INSERT policy and recreate with a simpler check
DROP POLICY IF EXISTS "Users can insert leads in their org" ON public.leads;

-- Create new INSERT policy that validates the organization_id matches user's org
-- Using a simpler subquery approach that won't fail
CREATE POLICY "Users can insert leads in their org" 
ON public.leads 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid()
  )
);