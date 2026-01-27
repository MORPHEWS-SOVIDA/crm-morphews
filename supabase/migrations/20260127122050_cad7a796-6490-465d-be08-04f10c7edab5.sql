-- =====================================================
-- PÓS-VENDA V2: Sistema de Perguntas Dinâmicas
-- =====================================================

-- Tabela de perguntas configuráveis por organização
CREATE TABLE public.post_sale_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'yes_no', -- yes_no, rating_0_10, text, medication
  position INT NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca por organização
CREATE INDEX idx_post_sale_questions_org ON public.post_sale_questions(organization_id, position);

-- Enable RLS
ALTER TABLE public.post_sale_questions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para post_sale_questions
CREATE POLICY "Membros podem ver perguntas da org"
  ON public.post_sale_questions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins podem gerenciar perguntas"
  ON public.post_sale_questions FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  );

-- Tabela de respostas flexíveis
CREATE TABLE public.post_sale_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES public.post_sale_surveys(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.post_sale_questions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_number INT,
  answer_boolean BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(survey_id, question_id)
);

-- Índices para respostas
CREATE INDEX idx_post_sale_responses_survey ON public.post_sale_responses(survey_id);
CREATE INDEX idx_post_sale_responses_question ON public.post_sale_responses(question_id);

-- Enable RLS
ALTER TABLE public.post_sale_responses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para post_sale_responses
CREATE POLICY "Membros podem ver respostas da org"
  ON public.post_sale_responses FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem criar respostas"
  ON public.post_sale_responses FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem atualizar respostas"
  ON public.post_sale_responses FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_post_sale_questions_updated_at
  BEFORE UPDATE ON public.post_sale_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();