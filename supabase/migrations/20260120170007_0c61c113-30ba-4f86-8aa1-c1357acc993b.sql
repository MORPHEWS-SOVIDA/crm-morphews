-- Persisted conversation state for WhatsApp assistant (to survive cold starts)
CREATE TABLE IF NOT EXISTS public.whatsapp_assistant_states (
  phone TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_assistant_states_expires_at
  ON public.whatsapp_assistant_states (expires_at);

ALTER TABLE public.whatsapp_assistant_states ENABLE ROW LEVEL SECURITY;

-- Deny direct access from client roles; service role (backend) bypasses RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_assistant_states'
      AND policyname = 'No direct access'
  ) THEN
    CREATE POLICY "No direct access"
      ON public.whatsapp_assistant_states
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END$$;