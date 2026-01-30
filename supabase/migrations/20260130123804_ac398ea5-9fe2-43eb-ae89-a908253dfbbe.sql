-- =====================================================
-- MIGRATION: Isolate partners from organization_members
-- Partners should NOT be in organization_members - they are external entities
-- =====================================================

-- 1. Delete partner roles from organization_members
DELETE FROM organization_members
WHERE role IN ('partner_affiliate', 'partner_coproducer', 'partner_industry', 'partner_factory');

-- 2. Create a stricter function for checking REAL team members (not partners)
-- Keep is_tenant_member unchanged for backward compatibility with RLS policies
CREATE OR REPLACE FUNCTION public.is_real_team_member(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = p_user_id
    AND organization_id = p_org_id
    AND role NOT IN ('partner_affiliate', 'partner_coproducer', 'partner_industry', 'partner_factory')
  );
$$;

-- 3. Create function to check if user is a partner via organization_affiliates
CREATE OR REPLACE FUNCTION public.is_partner(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_affiliates
    WHERE user_id = p_user_id
    AND organization_id = p_org_id
    AND is_active = true
  );
$$;

-- 4. Create function to get user's partner info if exists
CREATE OR REPLACE FUNCTION public.get_user_affiliate_info(p_user_id uuid, p_org_id uuid)
RETURNS TABLE(affiliate_id uuid, affiliate_code text, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, affiliate_code, is_active
  FROM organization_affiliates
  WHERE user_id = p_user_id
  AND organization_id = p_org_id
  LIMIT 1;
$$;

-- 5. Create index for faster partner lookups
CREATE INDEX IF NOT EXISTS idx_organization_affiliates_user_org 
ON organization_affiliates(user_id, organization_id) 
WHERE user_id IS NOT NULL;

-- 6. Add comment to document that partner_* roles are deprecated
COMMENT ON TYPE org_role IS 'Organization member roles. DEPRECATED: partner_affiliate, partner_coproducer, partner_industry, partner_factory - these should be in organization_affiliates table, not organization_members.';