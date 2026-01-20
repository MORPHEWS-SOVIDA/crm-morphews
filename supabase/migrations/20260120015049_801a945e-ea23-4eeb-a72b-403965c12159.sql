-- Drop the restrictive UPDATE policy that only allows user to update their own records
DROP POLICY IF EXISTS "Users can update their own receptive_attendances" ON public.receptive_attendances;

-- Create a new policy that allows any user in the organization to update attendances
-- This enables managers to add recordings, notes, etc. to any attendance in their org
CREATE POLICY "Users can update receptive_attendances of their org" 
ON public.receptive_attendances 
FOR UPDATE 
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());