
-- Recreate get_user_organization_id function to be more robust
-- Ensuring it works in all contexts including RLS evaluation
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT organization_id 
  FROM public.organization_members 
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Also ensure there's a SELECT policy that allows users to see their own membership 
-- regardless of other policies
DROP POLICY IF EXISTS "Users can view their own membership" ON public.organization_members;

CREATE POLICY "Users can view their own membership" 
ON public.organization_members 
FOR SELECT 
USING (user_id = auth.uid());
