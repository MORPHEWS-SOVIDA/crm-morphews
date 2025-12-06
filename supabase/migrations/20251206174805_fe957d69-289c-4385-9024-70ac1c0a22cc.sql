
-- CORREÇÃO CRÍTICA: search_path vazio impede auth.uid() de funcionar
-- Mudando para search_path = 'public' que é o padrão do Supabase

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid;
BEGIN
  SELECT organization_id INTO org_id
  FROM public.organization_members 
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_can_insert_to_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
    AND organization_id = _org_id
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
    AND organization_id = _org_id
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.user_can_see_lead(_user_id uuid, _lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  SELECT (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.leads l ON l.organization_id = om.organization_id
      WHERE om.user_id = _user_id
      AND l.id = _lead_id
      AND om.can_see_all_leads = true
    )
    OR EXISTS (
      SELECT 1 FROM public.lead_responsibles lr
      WHERE lr.user_id = _user_id
      AND lr.lead_id = _lead_id
    )
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;
