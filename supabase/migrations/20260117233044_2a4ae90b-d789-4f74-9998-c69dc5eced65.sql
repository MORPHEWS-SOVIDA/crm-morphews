-- Fix 1: Add rate limiting trigger to interested_leads table
-- This prevents spam by limiting submissions from the same WhatsApp or email within 1 hour

CREATE OR REPLACE FUNCTION public.check_interested_lead_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if there's a recent submission from the same WhatsApp
  IF EXISTS (
    SELECT 1 FROM interested_leads
    WHERE whatsapp = NEW.whatsapp
    AND created_at > NOW() - INTERVAL '1 hour'
  ) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before submitting again.';
  END IF;
  
  -- Check if there's a recent submission from the same email (if provided)
  IF NEW.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM interested_leads
    WHERE email = NEW.email
    AND created_at > NOW() - INTERVAL '1 hour'
  ) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before submitting again.';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_interested_lead_rate_limit_trigger ON interested_leads;
CREATE TRIGGER check_interested_lead_rate_limit_trigger
BEFORE INSERT ON interested_leads
FOR EACH ROW EXECUTE FUNCTION public.check_interested_lead_rate_limit();

-- Fix 2: Tighten subscription_plans visibility
-- Users can only see active plans, their org's plan, or if they're master admin

DROP POLICY IF EXISTS "Authenticated users can view subscription plans" ON subscription_plans;

CREATE POLICY "Users can view active subscription plans"
ON subscription_plans FOR SELECT TO authenticated
USING (
  is_active = true
  OR public.is_master_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.plan_id = subscription_plans.id
    AND s.organization_id = public.current_tenant_id()
  )
);