-- Allow org members to read the plan they are subscribed to even if the plan is not active/public (e.g., Influencer)

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Create policy only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_plans'
      AND policyname = 'Subscribed org can view assigned plan'
  ) THEN
    CREATE POLICY "Subscribed org can view assigned plan"
    ON public.subscription_plans
    FOR SELECT
    TO authenticated
    USING (
      public.is_master_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.subscriptions s
        WHERE s.organization_id = public.current_tenant_id()
          AND s.plan_id = public.subscription_plans.id
      )
    );
  END IF;
END$$;