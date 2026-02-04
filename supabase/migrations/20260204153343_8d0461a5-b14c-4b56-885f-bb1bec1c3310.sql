-- Add trial fields to subscription_plans
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_requires_card boolean DEFAULT true;

-- Add comment
COMMENT ON COLUMN public.subscription_plans.trial_days IS 'Number of free trial days (0 = no trial)';
COMMENT ON COLUMN public.subscription_plans.trial_requires_card IS 'If true, collect card upfront and charge after trial. If false, allow free access and require subscription after trial.';

-- Add trial tracking to subscriptions
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS trial_started_at timestamp with time zone;

-- Add comment
COMMENT ON COLUMN public.subscriptions.trial_ends_at IS 'When the trial period ends';
COMMENT ON COLUMN public.subscriptions.trial_started_at IS 'When the trial started';

-- Create function to check if subscription is in active trial or paid
CREATE OR REPLACE FUNCTION public.is_subscription_active(sub_row subscriptions)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Active statuses
  IF sub_row.status IN ('active', 'trialing') THEN
    RETURN true;
  END IF;
  
  -- Check if still in trial period (for subscriptions without card)
  IF sub_row.status = 'trialing' AND sub_row.trial_ends_at IS NOT NULL THEN
    RETURN sub_row.trial_ends_at > now();
  END IF;
  
  RETURN false;
END;
$$;

-- Create RPC to check current user's subscription status
CREATE OR REPLACE FUNCTION public.get_my_subscription_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid;
  sub_record record;
  result jsonb;
BEGIN
  -- Get user's organization
  SELECT organization_id INTO org_id
  FROM profiles
  WHERE user_id = auth.uid();
  
  IF org_id IS NULL THEN
    RETURN jsonb_build_object(
      'has_subscription', false,
      'status', null,
      'is_trial', false,
      'trial_expired', false,
      'days_remaining', null
    );
  END IF;
  
  -- Get subscription
  SELECT 
    s.*,
    sp.name as plan_name,
    sp.trial_days,
    sp.trial_requires_card
  INTO sub_record
  FROM subscriptions s
  LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
  WHERE s.organization_id = org_id
  LIMIT 1;
  
  IF sub_record IS NULL THEN
    RETURN jsonb_build_object(
      'has_subscription', false,
      'status', null,
      'is_trial', false,
      'trial_expired', false,
      'days_remaining', null
    );
  END IF;
  
  -- Calculate trial status
  result := jsonb_build_object(
    'has_subscription', true,
    'status', sub_record.status,
    'plan_name', sub_record.plan_name,
    'is_trial', sub_record.status = 'trialing',
    'trial_ends_at', sub_record.trial_ends_at,
    'trial_expired', (
      sub_record.status = 'trialing' 
      AND sub_record.trial_ends_at IS NOT NULL 
      AND sub_record.trial_ends_at < now()
    ),
    'days_remaining', CASE 
      WHEN sub_record.trial_ends_at IS NOT NULL AND sub_record.trial_ends_at > now()
      THEN EXTRACT(DAY FROM (sub_record.trial_ends_at - now()))::integer
      ELSE 0
    END
  );
  
  RETURN result;
END;
$$;