
-- Tipos de pergunta padrão
CREATE TYPE public.standard_question_type AS ENUM (
  'single_choice',
  'multiple_choice',
  'number',
  'imc_calculator'
);

-- Categorias de perguntas padrão
CREATE TYPE public.standard_question_category AS ENUM (
  'dores_articulares',
  'emagrecimento',
  'diabetes',
  'saude_geral'
);

-- Tabela de perguntas padrão (por organização)
CREATE TABLE public.standard_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category public.standard_question_category NOT NULL,
  question_text TEXT NOT NULL,
  question_type public.standard_question_type NOT NULL DEFAULT 'single_choice',
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Opções de resposta para perguntas padrão
CREATE TABLE public.standard_question_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.standard_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Vinculação de perguntas padrão a produtos
CREATE TABLE public.product_standard_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.standard_questions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, question_id)
);

-- Respostas dos leads às perguntas padrão
CREATE TABLE public.lead_standard_question_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.standard_questions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Para single_choice e multiple_choice
  selected_option_ids UUID[] DEFAULT '{}',
  -- Para number e imc_calculator
  numeric_value DECIMAL(10,2),
  -- Para IMC: armazena peso, altura, idade separadamente
  imc_weight DECIMAL(5,2),
  imc_height DECIMAL(3,2),
  imc_age INTEGER,
  imc_result DECIMAL(5,2),
  imc_category TEXT,
  -- Metadata
  answered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, question_id)
);

-- Enable RLS
ALTER TABLE public.standard_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_standard_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_standard_question_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for standard_questions
CREATE POLICY "Users can view their organization's standard questions"
ON public.standard_questions FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Admins can manage standard questions"
ON public.standard_questions FOR ALL
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members 
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
));

-- RLS Policies for standard_question_options
CREATE POLICY "Users can view question options"
ON public.standard_question_options FOR SELECT
USING (question_id IN (
  SELECT id FROM public.standard_questions WHERE organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Admins can manage question options"
ON public.standard_question_options FOR ALL
USING (question_id IN (
  SELECT id FROM public.standard_questions WHERE organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
));

-- RLS Policies for product_standard_questions
CREATE POLICY "Users can view product standard questions"
ON public.product_standard_questions FOR SELECT
USING (product_id IN (
  SELECT id FROM public.lead_products WHERE organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Admins can manage product standard questions"
ON public.product_standard_questions FOR ALL
USING (product_id IN (
  SELECT id FROM public.lead_products WHERE organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
));

-- RLS Policies for lead_standard_question_answers
CREATE POLICY "Users can view their organization's answers"
ON public.lead_standard_question_answers FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Users can manage answers"
ON public.lead_standard_question_answers FOR ALL
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

-- Indexes for performance
CREATE INDEX idx_standard_questions_org ON public.standard_questions(organization_id);
CREATE INDEX idx_standard_questions_category ON public.standard_questions(category);
CREATE INDEX idx_standard_question_options_question ON public.standard_question_options(question_id);
CREATE INDEX idx_product_standard_questions_product ON public.product_standard_questions(product_id);
CREATE INDEX idx_lead_standard_answers_lead ON public.lead_standard_question_answers(lead_id);
CREATE INDEX idx_lead_standard_answers_question ON public.lead_standard_question_answers(question_id);
CREATE INDEX idx_lead_standard_answers_options ON public.lead_standard_question_answers USING GIN(selected_option_ids);

-- Trigger for updated_at
CREATE TRIGGER update_standard_questions_updated_at
BEFORE UPDATE ON public.standard_questions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_standard_answers_updated_at
BEFORE UPDATE ON public.lead_standard_question_answers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
