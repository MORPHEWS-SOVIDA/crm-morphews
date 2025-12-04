-- Tabela para trackear progresso de onboarding do usuário
CREATE TABLE public.user_onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Etapas completadas
  welcome_sent BOOLEAN DEFAULT false,
  first_lead_created BOOLEAN DEFAULT false,
  first_lead_tips_sent BOOLEAN DEFAULT false,
  leads_count_milestone_3 BOOLEAN DEFAULT false,
  funnel_tips_sent BOOLEAN DEFAULT false,
  first_stage_update BOOLEAN DEFAULT false,
  stage_tips_sent BOOLEAN DEFAULT false,
  
  -- Contadores
  leads_created_count INTEGER DEFAULT 0,
  stage_updates_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own onboarding progress"
  ON public.user_onboarding_progress FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can manage onboarding progress"
  ON public.user_onboarding_progress FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_onboarding_progress_updated_at
  BEFORE UPDATE ON public.user_onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();