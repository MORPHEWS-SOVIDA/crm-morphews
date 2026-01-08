-- =====================================================
-- PLAN FEATURES: Define which features each plan includes
-- =====================================================

CREATE TABLE public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, feature_key)
);

-- Enable RLS
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

-- Master admin can manage plan features
CREATE POLICY "Master admin can manage plan features"
ON public.plan_features
FOR ALL
USING (is_master_admin(auth.uid()))
WITH CHECK (is_master_admin(auth.uid()));

-- Anyone authenticated can read plan features (to know what their plan includes)
CREATE POLICY "Authenticated users can view plan features"
ON public.plan_features
FOR SELECT
TO authenticated
USING (true);

-- =====================================================
-- ORGANIZATION FEATURE OVERRIDES: Super admin can override per org
-- =====================================================

CREATE TABLE public.organization_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL,
  override_reason TEXT,
  overridden_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, feature_key)
);

-- Enable RLS
ALTER TABLE public.organization_feature_overrides ENABLE ROW LEVEL SECURITY;

-- Master admin can manage overrides
CREATE POLICY "Master admin can manage org feature overrides"
ON public.organization_feature_overrides
FOR ALL
USING (is_master_admin(auth.uid()))
WITH CHECK (is_master_admin(auth.uid()));

-- Org members can view their org's overrides
CREATE POLICY "Org members can view their overrides"
ON public.organization_feature_overrides
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization_id());

-- =====================================================
-- HELPER FUNCTION: Check if a feature is available for an organization
-- Checks: Plan features -> Org overrides
-- =====================================================

CREATE OR REPLACE FUNCTION public.org_has_feature(_org_id UUID, _feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  override_value BOOLEAN;
  plan_value BOOLEAN;
  org_plan_id UUID;
BEGIN
  -- First check if there's an override for this org
  SELECT is_enabled INTO override_value
  FROM organization_feature_overrides
  WHERE organization_id = _org_id
    AND feature_key = _feature_key;
  
  -- If override exists, use it
  IF override_value IS NOT NULL THEN
    RETURN override_value;
  END IF;
  
  -- Otherwise, check the plan
  SELECT s.plan_id INTO org_plan_id
  FROM subscriptions s
  WHERE s.organization_id = _org_id
    AND s.status = 'active'
  LIMIT 1;
  
  -- If no active subscription, default to false
  IF org_plan_id IS NULL THEN
    -- Check for free plan features maybe?
    RETURN false;
  END IF;
  
  -- Check plan features
  SELECT is_enabled INTO plan_value
  FROM plan_features
  WHERE plan_id = org_plan_id
    AND feature_key = _feature_key;
  
  -- If feature not defined in plan, default to true (backwards compatibility)
  RETURN COALESCE(plan_value, true);
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_plan_features_updated_at
  BEFORE UPDATE ON plan_features
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_feature_overrides_updated_at
  BEFORE UPDATE ON organization_feature_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();