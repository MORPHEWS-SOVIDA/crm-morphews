-- Update org_has_feature to include trialing subscriptions
CREATE OR REPLACE FUNCTION public.org_has_feature(_org_id UUID, _feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  
  -- Otherwise, check the plan (include both active and trialing subscriptions)
  SELECT s.plan_id INTO org_plan_id
  FROM subscriptions s
  WHERE s.organization_id = _org_id
    AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- If no active/trialing subscription, default to false
  IF org_plan_id IS NULL THEN
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