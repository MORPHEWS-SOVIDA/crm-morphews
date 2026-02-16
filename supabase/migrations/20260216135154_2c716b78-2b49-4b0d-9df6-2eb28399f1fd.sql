-- MESSAGING METRICS
CREATE TABLE IF NOT EXISTS public.messaging_daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  instance_id UUID REFERENCES whatsapp_instances(id),
  channel_type channel_type NOT NULL DEFAULT 'whatsapp',
  metric_date DATE NOT NULL,
  messages_sent INTEGER NOT NULL DEFAULT 0,
  messages_received INTEGER NOT NULL DEFAULT 0,
  messages_from_bot INTEGER NOT NULL DEFAULT 0,
  conversations_opened INTEGER NOT NULL DEFAULT 0,
  conversations_closed INTEGER NOT NULL DEFAULT 0,
  conversations_inbound INTEGER NOT NULL DEFAULT 0,
  conversations_outbound INTEGER NOT NULL DEFAULT 0,
  leads_linked INTEGER NOT NULL DEFAULT 0,
  leads_created INTEGER NOT NULL DEFAULT 0,
  funnel_stage_changes INTEGER NOT NULL DEFAULT 0,
  nps_sent INTEGER NOT NULL DEFAULT 0,
  nps_responded INTEGER NOT NULL DEFAULT 0,
  nps_avg_score NUMERIC(3,1),
  avg_first_response_minutes NUMERIC(8,1),
  avg_resolution_minutes NUMERIC(8,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_daily_metric UNIQUE (organization_id, instance_id, channel_type, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_messaging_metrics_org_date ON messaging_daily_metrics(organization_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_messaging_metrics_channel ON messaging_daily_metrics(channel_type, metric_date);

ALTER TABLE messaging_daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can read all metrics"
ON messaging_daily_metrics FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Org members can read own metrics"
ON messaging_daily_metrics FOR SELECT
USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

-- CONVERSATION LEAD LINKS (audit trail)
CREATE TABLE IF NOT EXISTS public.conversation_lead_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  conversation_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES leads(id),
  channel_type channel_type NOT NULL DEFAULT 'whatsapp',
  linked_by TEXT NOT NULL DEFAULT 'manual',
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lead_name TEXT,
  lead_whatsapp TEXT,
  instagram_username TEXT,
  funnel_stage_at_link TEXT
);

CREATE INDEX IF NOT EXISTS idx_conv_lead_links_org ON conversation_lead_links(organization_id, linked_at);
ALTER TABLE conversation_lead_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin read lead links" ON conversation_lead_links FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Org members read lead links" ON conversation_lead_links FOR SELECT USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
CREATE POLICY "System insert lead links" ON conversation_lead_links FOR INSERT WITH CHECK (true);

-- AGGREGATE FUNCTION
CREATE OR REPLACE FUNCTION public.aggregate_daily_messaging_metrics(p_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  INSERT INTO messaging_daily_metrics (
    organization_id, instance_id, channel_type, metric_date,
    messages_sent, messages_received, messages_from_bot,
    conversations_opened, conversations_closed, leads_linked
  )
  SELECT 
    c.organization_id, m.instance_id,
    COALESCE(c.channel_type, 'whatsapp'),
    p_date,
    COUNT(*) FILTER (WHERE m.direction = 'outbound'),
    COUNT(*) FILTER (WHERE m.direction = 'inbound'),
    COUNT(*) FILTER (WHERE m.is_from_bot = true),
    COUNT(DISTINCT c.id) FILTER (WHERE c.created_at::date = p_date),
    COUNT(DISTINCT c.id) FILTER (WHERE c.closed_at::date = p_date),
    COUNT(DISTINCT c.lead_id) FILTER (WHERE c.lead_id IS NOT NULL)
  FROM whatsapp_messages m
  JOIN whatsapp_conversations c ON c.id = m.conversation_id
  WHERE m.created_at::date = p_date
  GROUP BY c.organization_id, m.instance_id, COALESCE(c.channel_type, 'whatsapp')
  ON CONFLICT (organization_id, instance_id, channel_type, metric_date)
  DO UPDATE SET
    messages_sent = EXCLUDED.messages_sent,
    messages_received = EXCLUDED.messages_received,
    messages_from_bot = EXCLUDED.messages_from_bot,
    conversations_opened = EXCLUDED.conversations_opened,
    conversations_closed = EXCLUDED.conversations_closed,
    leads_linked = EXCLUDED.leads_linked,
    updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('date', p_date, 'rows_upserted', v_count);
END;
$$;