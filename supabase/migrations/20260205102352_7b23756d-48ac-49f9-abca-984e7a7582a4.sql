-- ========================================
-- 1. TOOLS NA CHAMADA - Tabela de configuração de tools do agente
-- ========================================
CREATE TABLE public.voice_ai_agent_tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES voice_ai_agents(id) ON DELETE CASCADE,
  tool_type TEXT NOT NULL CHECK (tool_type IN ('transfer_human', 'book_appointment', 'dtmf', 'api_call', 'send_sms', 'update_crm', 'webhook')),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  trigger_keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ========================================
-- 2. BASE DE CONHECIMENTO
-- ========================================
CREATE TABLE public.voice_ai_knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES voice_ai_agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'pdf', 'url', 'qa_pair')),
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size_bytes INTEGER,
  qa_question TEXT,
  qa_answer TEXT,
  is_active BOOLEAN DEFAULT true,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processed_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ========================================
-- 3. AUTOMAÇÕES PÓS-LIGAÇÃO
-- ========================================
CREATE TABLE public.voice_ai_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES voice_ai_agents(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL CHECK (trigger_event IN ('call_ended', 'appointment_booked', 'transfer_requested', 'sentiment_negative', 'sentiment_positive', 'outcome_sale', 'outcome_no_answer')),
  action_type TEXT NOT NULL CHECK (action_type IN ('webhook', 'update_lead', 'send_notification', 'create_task', 'send_email', 'send_sms', 'add_tag')),
  action_config JSONB DEFAULT '{}',
  conditions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  executions_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Log de execuções das automações
CREATE TABLE public.voice_ai_automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL REFERENCES voice_ai_automations(id) ON DELETE CASCADE,
  call_id UUID REFERENCES voice_ai_call_logs(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ========================================
-- INDEXES
-- ========================================
CREATE INDEX idx_voice_ai_agent_tools_agent ON voice_ai_agent_tools(agent_id);
CREATE INDEX idx_voice_ai_agent_tools_org ON voice_ai_agent_tools(organization_id);
CREATE INDEX idx_voice_ai_knowledge_base_agent ON voice_ai_knowledge_base(agent_id);
CREATE INDEX idx_voice_ai_knowledge_base_org ON voice_ai_knowledge_base(organization_id);
CREATE INDEX idx_voice_ai_automations_agent ON voice_ai_automations(agent_id);
CREATE INDEX idx_voice_ai_automations_org ON voice_ai_automations(organization_id);
CREATE INDEX idx_voice_ai_automations_trigger ON voice_ai_automations(trigger_event);
CREATE INDEX idx_voice_ai_automation_logs_automation ON voice_ai_automation_logs(automation_id);

-- ========================================
-- RLS POLICIES
-- ========================================
ALTER TABLE public.voice_ai_agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_ai_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_ai_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_ai_automation_logs ENABLE ROW LEVEL SECURITY;

-- Agent Tools policies
CREATE POLICY "Users can view agent tools from their org" ON voice_ai_agent_tools
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create agent tools in their org" ON voice_ai_agent_tools
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update agent tools in their org" ON voice_ai_agent_tools
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete agent tools in their org" ON voice_ai_agent_tools
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- Knowledge base policies
CREATE POLICY "Users can view knowledge base from their org" ON voice_ai_knowledge_base
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create knowledge base in their org" ON voice_ai_knowledge_base
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update knowledge base in their org" ON voice_ai_knowledge_base
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete knowledge base in their org" ON voice_ai_knowledge_base
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- Automations policies
CREATE POLICY "Users can view automations from their org" ON voice_ai_automations
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create automations in their org" ON voice_ai_automations
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update automations in their org" ON voice_ai_automations
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete automations in their org" ON voice_ai_automations
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- Automation logs policies
CREATE POLICY "Users can view automation logs from their org" ON voice_ai_automation_logs
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert automation logs in their org" ON voice_ai_automation_logs
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );