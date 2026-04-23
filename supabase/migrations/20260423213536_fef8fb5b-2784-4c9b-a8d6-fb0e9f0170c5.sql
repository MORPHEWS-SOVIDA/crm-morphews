-- Replace fragile subquery-based policies with security-definer helpers
DROP POLICY IF EXISTS "Org members can create imports" ON public.social_selling_imports;
DROP POLICY IF EXISTS "Org members can update imports" ON public.social_selling_imports;
DROP POLICY IF EXISTS "Org members can view imports" ON public.social_selling_imports;

-- Helper that checks membership in organization_members (active) OR profiles
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND COALESCE(is_active, true) = true
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
  );
$$;

CREATE POLICY "Org members can view imports"
ON public.social_selling_imports
FOR SELECT
USING (public.user_belongs_to_org(organization_id));

CREATE POLICY "Org members can create imports"
ON public.social_selling_imports
FOR INSERT
WITH CHECK (public.user_belongs_to_org(organization_id));

CREATE POLICY "Org members can update imports"
ON public.social_selling_imports
FOR UPDATE
USING (public.user_belongs_to_org(organization_id))
WITH CHECK (public.user_belongs_to_org(organization_id));