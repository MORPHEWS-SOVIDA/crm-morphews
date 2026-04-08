
-- Knowledge table for Agents 2.0 (no FK to ai_bots since agent IDs come from external project)
CREATE TABLE public.agent_knowledge_v2 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  organization_id UUID,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_knowledge_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read agent knowledge"
  ON public.agent_knowledge_v2 FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert agent knowledge"
  ON public.agent_knowledge_v2 FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete agent knowledge"
  ON public.agent_knowledge_v2 FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_agent_knowledge_v2_agent ON public.agent_knowledge_v2(agent_id);

-- Execution logs table for Agents 2.0
CREATE TABLE public.agent_logs_v2 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID,
  conversation_id UUID,
  organization_id UUID,
  success BOOLEAN,
  execution_time_ms INTEGER,
  total_tokens INTEGER,
  iterations INTEGER,
  tools_used JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.agent_logs_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read agent logs"
  ON public.agent_logs_v2 FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert agent logs"
  ON public.agent_logs_v2 FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_agent_logs_v2_agent ON public.agent_logs_v2(agent_id);
CREATE INDEX idx_agent_logs_v2_created ON public.agent_logs_v2(created_at DESC);
