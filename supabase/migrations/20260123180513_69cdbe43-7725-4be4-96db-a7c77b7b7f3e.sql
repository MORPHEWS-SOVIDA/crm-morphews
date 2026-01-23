-- Create function to check if current user is organization owner
CREATE OR REPLACE FUNCTION public.is_current_user_org_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = public.get_user_organization_id()
      AND om.role = 'owner'
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_current_user_org_owner() TO authenticated;