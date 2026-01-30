-- =====================================================
-- MIGRATION: Update get_tenant_role to support external affiliates
-- Affiliates are no longer in organization_members, so we need to check organization_affiliates
-- =====================================================

-- Drop and recreate the function with updated logic
DROP FUNCTION IF EXISTS public.get_tenant_role(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_tenant_role(_user_id uuid, _tenant_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- First check if user is a regular team member
  SELECT COALESCE(
    (SELECT role::text
     FROM public.organization_members
     WHERE user_id = _user_id
     AND organization_id = _tenant_id
     LIMIT 1),
    -- If not a team member, check if user is an affiliate
    (SELECT 'partner_affiliate'::text
     FROM public.organization_affiliates
     WHERE user_id = _user_id
     AND organization_id = _tenant_id
     AND is_active = true
     LIMIT 1)
  )
$$;