-- Tabela para armazenar preferências aprendidas do cliente
CREATE TABLE public.lead_ai_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL, -- 'product_interest', 'communication_style', 'budget_range', 'timing', 'concern'
  preference_key TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  confidence_score NUMERIC(3,2) DEFAULT 0.5, -- 0.00 a 1.00
  last_observed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  observation_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, lead_id, preference_type, preference_key)
);

-- Tabela para resumos de conversa (memória de longo prazo)
CREATE TABLE public.lead_conversation_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  summary_text TEXT NOT NULL,
  key_topics TEXT[] DEFAULT '{}',
  sentiment TEXT, -- 'positive', 'neutral', 'negative'
  action_items TEXT[] DEFAULT '{}',
  next_steps TEXT,
  energy_consumed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_lead_ai_preferences_lead ON public.lead_ai_preferences(lead_id);
CREATE INDEX idx_lead_ai_preferences_org_lead ON public.lead_ai_preferences(organization_id, lead_id);
CREATE INDEX idx_lead_conversation_summaries_lead ON public.lead_conversation_summaries(lead_id);
CREATE INDEX idx_lead_conversation_summaries_org_lead ON public.lead_conversation_summaries(organization_id, lead_id);

-- RLS
ALTER TABLE public.lead_ai_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Policies para lead_ai_preferences
CREATE POLICY "Users can view preferences in their org"
ON public.lead_ai_preferences FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert preferences in their org"
ON public.lead_ai_preferences FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update preferences in their org"
ON public.lead_ai_preferences FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Policies para lead_conversation_summaries
CREATE POLICY "Users can view summaries in their org"
ON public.lead_conversation_summaries FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert summaries in their org"
ON public.lead_conversation_summaries FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Service role pode tudo (para edge functions)
CREATE POLICY "Service role full access preferences"
ON public.lead_ai_preferences FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access summaries"
ON public.lead_conversation_summaries FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Trigger para updated_at
CREATE TRIGGER update_lead_ai_preferences_updated_at
BEFORE UPDATE ON public.lead_ai_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar campo na instância para ativar memória de longo prazo
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS ai_memory_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_learning_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_seller_briefing_enabled BOOLEAN DEFAULT false;