-- Drop the incorrect policy
DROP POLICY IF EXISTS "Org admins can update profiles of their org members" ON public.profiles;

-- Recreate with correct parameter order
CREATE POLICY "Org admins can update profiles of their org members"
ON public.profiles
FOR UPDATE
USING (
  organization_id = get_user_organization_id() 
  AND is_org_admin(auth.uid(), get_user_organization_id())
);