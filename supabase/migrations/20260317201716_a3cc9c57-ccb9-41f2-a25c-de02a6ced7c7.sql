CREATE TABLE IF NOT EXISTS public.ai_provider_failure_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  conversation_id text,
  bot_id uuid,
  provider text NOT NULL,
  model text,
  error_code text,
  error_message text,
  fallback_provider text,
  fallback_succeeded boolean DEFAULT false,
  consecutive_failures int DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_provider_failures_created ON public.ai_provider_failure_logs(created_at DESC);
CREATE INDEX idx_ai_provider_failures_provider ON public.ai_provider_failure_logs(provider, created_at DESC);

ALTER TABLE public.ai_provider_failure_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ai_provider_failure_logs"
ON public.ai_provider_failure_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Org members can view failure logs"
ON public.ai_provider_failure_logs
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);