
-- Tabela de fila de follow-ups automáticos da Super IA
CREATE TABLE public.ai_followup_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  conversation_id uuid NULL,
  whatsapp_instance_id uuid NULL,
  trigger_type text NOT NULL DEFAULT 'cron_inactive',
  context_snapshot jsonb DEFAULT '{}'::jsonb,
  generated_message text NULL,
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  error_message text NULL,
  ai_model_used text NULL,
  tokens_used integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_followup_queue_trigger_type_check CHECK (trigger_type IN ('cron_inactive', 'event_stage_change', 'event_cart_abandon', 'event_post_sale', 'event_payment_declined', 'manual')),
  CONSTRAINT ai_followup_queue_status_check CHECK (status IN ('pending', 'generating', 'ready', 'sending', 'sent', 'skipped', 'failed'))
);

-- Índices para performance
CREATE INDEX idx_ai_followup_queue_pending ON public.ai_followup_queue (organization_id, status, scheduled_for) WHERE status IN ('pending', 'ready');
CREATE INDEX idx_ai_followup_queue_lead ON public.ai_followup_queue (lead_id, created_at DESC);

-- RLS
ALTER TABLE public.ai_followup_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org followup queue"
ON public.ai_followup_queue FOR SELECT TO authenticated
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can manage their org followup queue"
ON public.ai_followup_queue FOR ALL TO authenticated
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

-- Configuração de follow-up por organização
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS ai_followup_config jsonb DEFAULT '{
    "enabled": false,
    "inactive_hours": 4,
    "max_followups_per_lead": 3,
    "cooldown_hours": 24,
    "triggers": {
      "cron_inactive": true,
      "event_stage_change": true,
      "event_cart_abandon": true,
      "event_post_sale": true,
      "event_payment_declined": false
    },
    "ai_model": "claude-sonnet",
    "working_hours_only": true,
    "working_hours_start": "08:00",
    "working_hours_end": "20:00"
  }'::jsonb;

-- Trigger para updated_at
CREATE TRIGGER update_ai_followup_queue_updated_at
  BEFORE UPDATE ON public.ai_followup_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
