-- =============================================================================
-- QUIZ BUILDER SYSTEM - Tabelas para criação e análise de quizzes
-- =============================================================================

-- Tabela principal de Quizzes
CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Identificação
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  
  -- Configurações visuais
  logo_url TEXT,
  primary_color TEXT DEFAULT '#6366f1',
  background_color TEXT DEFAULT '#ffffff',
  show_progress_bar BOOLEAN DEFAULT true,
  
  -- Configurações de comportamento
  is_active BOOLEAN DEFAULT true,
  requires_lead_capture BOOLEAN DEFAULT false,
  
  -- Integração CRM (UUIDs sem FK para flexibilidade)
  default_product_id UUID,
  default_funnel_stage_id UUID,
  default_seller_id UUID,
  auto_start_followup BOOLEAN DEFAULT false,
  followup_reason_id UUID,
  
  -- Tracking pixels
  facebook_pixel_id TEXT,
  google_analytics_id TEXT,
  tiktok_pixel_id TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_quiz_slug_per_org UNIQUE (organization_id, slug)
);

-- Etapas/Perguntas do Quiz
CREATE TABLE public.quiz_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Tipo de etapa
  step_type TEXT NOT NULL CHECK (step_type IN (
    'single_choice',
    'multiple_choice',
    'text_input',
    'number_input',
    'lead_capture',
    'imc_calculator',
    'result',
    'info'
  )),
  
  -- Conteúdo
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  video_url TEXT,
  
  -- Configurações de lead capture
  capture_name BOOLEAN DEFAULT false,
  capture_email BOOLEAN DEFAULT false,
  capture_whatsapp BOOLEAN DEFAULT false,
  capture_cpf BOOLEAN DEFAULT false,
  
  -- Configurações de resultado
  result_title TEXT,
  result_description TEXT,
  result_image_url TEXT,
  result_cta_type TEXT CHECK (result_cta_type IN ('url', 'whatsapp', 'storefront', 'product')),
  result_cta_url TEXT,
  result_cta_text TEXT DEFAULT 'Continuar',
  result_whatsapp_message TEXT,
  result_product_id UUID,
  result_storefront_id UUID,
  
  -- Ordenação e branching
  position INTEGER NOT NULL DEFAULT 0,
  next_step_id UUID,
  is_required BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Opções para perguntas de escolha
CREATE TABLE public.quiz_step_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_id UUID NOT NULL REFERENCES public.quiz_steps(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Conteúdo
  label TEXT NOT NULL,
  value TEXT,
  image_url TEXT,
  emoji TEXT,
  
  -- Branching - para onde ir se selecionar esta opção
  next_step_id UUID,
  
  -- Score/peso para cálculo de resultado
  score INTEGER DEFAULT 0,
  result_tag TEXT,
  
  position INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sessões de Quiz (cada visitante único)
CREATE TABLE public.quiz_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Identificação do visitante
  visitor_fingerprint TEXT,
  
  -- Lead associado (quando capturado)
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  
  -- Dados capturados
  captured_name TEXT,
  captured_email TEXT,
  captured_whatsapp TEXT,
  captured_cpf TEXT,
  
  -- Tracking
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  fbclid TEXT,
  gclid TEXT,
  ttclid TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  
  -- Estado
  current_step_id UUID,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Resultado
  final_result_tag TEXT,
  total_score INTEGER DEFAULT 0,
  
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Respostas individuais
CREATE TABLE public.quiz_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.quiz_steps(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Resposta
  selected_option_ids UUID[] DEFAULT '{}',
  text_value TEXT,
  numeric_value NUMERIC,
  
  -- Para IMC
  imc_weight NUMERIC,
  imc_height NUMERIC,
  imc_result NUMERIC,
  imc_category TEXT,
  
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_answer_per_session_step UNIQUE (session_id, step_id)
);

-- Eventos de Analytics (views, cliques, etc)
CREATE TABLE public.quiz_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.quiz_sessions(id) ON DELETE SET NULL,
  step_id UUID,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Tipo de evento
  event_type TEXT NOT NULL CHECK (event_type IN (
    'quiz_view',
    'step_view',
    'step_complete',
    'lead_captured',
    'quiz_complete',
    'cta_click',
    'drop_off'
  )),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_quizzes_org ON public.quizzes(organization_id);
CREATE INDEX idx_quizzes_slug ON public.quizzes(slug);
CREATE INDEX idx_quizzes_active ON public.quizzes(is_active);
CREATE INDEX idx_quiz_steps_quiz ON public.quiz_steps(quiz_id);
CREATE INDEX idx_quiz_steps_position ON public.quiz_steps(quiz_id, position);
CREATE INDEX idx_quiz_options_step ON public.quiz_step_options(step_id);
CREATE INDEX idx_quiz_sessions_quiz ON public.quiz_sessions(quiz_id);
CREATE INDEX idx_quiz_sessions_lead ON public.quiz_sessions(lead_id);
CREATE INDEX idx_quiz_sessions_completed ON public.quiz_sessions(is_completed);
CREATE INDEX idx_quiz_answers_session ON public.quiz_answers(session_id);
CREATE INDEX idx_quiz_events_quiz ON public.quiz_events(quiz_id);
CREATE INDEX idx_quiz_events_session ON public.quiz_events(session_id);
CREATE INDEX idx_quiz_events_type ON public.quiz_events(event_type);
CREATE INDEX idx_quiz_events_created ON public.quiz_events(created_at);

-- Enable RLS
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_step_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies para gestão (usuários autenticados da org)
CREATE POLICY "Org members can manage quizzes" ON public.quizzes
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can manage quiz steps" ON public.quiz_steps
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can manage quiz options" ON public.quiz_step_options
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can view quiz sessions" ON public.quiz_sessions
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can view quiz answers" ON public.quiz_answers
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can view quiz events" ON public.quiz_events
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

-- Políticas públicas para visitantes do quiz (INSERT apenas)
CREATE POLICY "Public can create quiz sessions" ON public.quiz_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update own session" ON public.quiz_sessions
  FOR UPDATE USING (true);

CREATE POLICY "Public can insert quiz answers" ON public.quiz_answers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can insert quiz events" ON public.quiz_events
  FOR INSERT WITH CHECK (true);

-- Política pública para ler dados do quiz (para renderizar)
CREATE POLICY "Public can read active quizzes" ON public.quizzes
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read quiz steps" ON public.quiz_steps
  FOR SELECT USING (
    quiz_id IN (SELECT id FROM public.quizzes WHERE is_active = true)
  );

CREATE POLICY "Public can read quiz options" ON public.quiz_step_options
  FOR SELECT USING (
    step_id IN (
      SELECT id FROM public.quiz_steps 
      WHERE quiz_id IN (SELECT id FROM public.quizzes WHERE is_active = true)
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quiz_steps_updated_at
  BEFORE UPDATE ON public.quiz_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quiz_sessions_updated_at
  BEFORE UPDATE ON public.quiz_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime para sessions (dashboard ao vivo)
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_events;