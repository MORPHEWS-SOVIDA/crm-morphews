-- Tabela para logs de chamadas de voz com IA (ElevenLabs)
CREATE TABLE public.voice_ai_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  
  -- Tipo de chamada
  call_type TEXT NOT NULL CHECK (call_type IN ('inbound', 'outbound')),
  call_purpose TEXT, -- 'cart_recovery', 'follow_up', 'support', 'sales', etc.
  
  -- Status da chamada
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'cancelled')),
  
  -- Dados do contato
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  
  -- Configuração do agente
  agent_id TEXT, -- ElevenLabs agent ID
  agent_name TEXT,
  voice_id TEXT,
  
  -- Métricas da chamada
  started_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Transcrição e resumo
  transcript TEXT,
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  
  -- Resultado
  outcome TEXT, -- 'sale', 'callback_scheduled', 'not_interested', 'voicemail', etc.
  outcome_notes TEXT,
  next_action TEXT,
  next_action_date TIMESTAMPTZ,
  
  -- Custos
  cost_credits NUMERIC(10,4),
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Configurações de agentes de voz por organização
CREATE TABLE public.voice_ai_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- ElevenLabs config
  elevenlabs_agent_id TEXT,
  voice_id TEXT NOT NULL,
  voice_name TEXT,
  
  -- Comportamento
  system_prompt TEXT,
  first_message TEXT,
  language TEXT DEFAULT 'pt-BR',
  
  -- Horários
  working_hours_start TIME,
  working_hours_end TIME,
  working_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],
  out_of_hours_message TEXT,
  
  -- Limites
  max_call_duration_seconds INTEGER DEFAULT 300,
  max_daily_calls INTEGER,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Campanhas de chamadas outbound
CREATE TABLE public.voice_ai_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.voice_ai_agents(id) ON DELETE SET NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('cart_recovery', 'follow_up', 'reactivation', 'promotion', 'custom')),
  
  -- Filtros de leads
  lead_filters JSONB DEFAULT '{}',
  
  -- Agendamento
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  calls_per_hour INTEGER DEFAULT 10,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
  
  -- Métricas
  total_leads INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  calls_answered INTEGER DEFAULT 0,
  calls_converted INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX idx_voice_ai_calls_org ON public.voice_ai_calls(organization_id);
CREATE INDEX idx_voice_ai_calls_lead ON public.voice_ai_calls(lead_id);
CREATE INDEX idx_voice_ai_calls_status ON public.voice_ai_calls(status);
CREATE INDEX idx_voice_ai_calls_created ON public.voice_ai_calls(created_at DESC);
CREATE INDEX idx_voice_ai_agents_org ON public.voice_ai_agents(organization_id);
CREATE INDEX idx_voice_ai_campaigns_org ON public.voice_ai_campaigns(organization_id);
CREATE INDEX idx_voice_ai_campaigns_status ON public.voice_ai_campaigns(status);

-- RLS
ALTER TABLE public.voice_ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_ai_campaigns ENABLE ROW LEVEL SECURITY;

-- Policies para voice_ai_calls
CREATE POLICY "Users can view calls from their organization"
  ON public.voice_ai_calls FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert calls for their organization"
  ON public.voice_ai_calls FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update calls from their organization"
  ON public.voice_ai_calls FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- Policies para voice_ai_agents
CREATE POLICY "Users can view agents from their organization"
  ON public.voice_ai_agents FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage agents for their organization"
  ON public.voice_ai_agents FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- Policies para voice_ai_campaigns
CREATE POLICY "Users can view campaigns from their organization"
  ON public.voice_ai_campaigns FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage campaigns for their organization"
  ON public.voice_ai_campaigns FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- Trigger para updated_at
CREATE TRIGGER update_voice_ai_calls_updated_at
  BEFORE UPDATE ON public.voice_ai_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_voice_ai_agents_updated_at
  BEFORE UPDATE ON public.voice_ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_voice_ai_campaigns_updated_at
  BEFORE UPDATE ON public.voice_ai_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();