-- Add policy to allow users to view their own membership record
CREATE POLICY "Users can view their own membership"
ON public.organization_members
FOR SELECT
USING (user_id = auth.uid());