-- Create table for dynamic product questions
CREATE TABLE public.product_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for dynamic answers
CREATE TABLE public.lead_product_question_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.product_questions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  answer_text TEXT,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, question_id)
);

-- Enable RLS
ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_product_question_answers ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_questions
CREATE POLICY "Users can view questions of their org"
  ON public.product_questions FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can insert questions"
  ON public.product_questions FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can update questions"
  ON public.product_questions FOR UPDATE
  USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can delete questions"
  ON public.product_questions FOR DELETE
  USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

-- RLS policies for lead_product_question_answers
CREATE POLICY "Users can view answers of their org"
  ON public.lead_product_question_answers FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert answers in their org"
  ON public.lead_product_question_answers FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update answers of their org"
  ON public.lead_product_question_answers FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete answers of their org"
  ON public.lead_product_question_answers FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Create indexes for performance
CREATE INDEX idx_product_questions_product_id ON public.product_questions(product_id);
CREATE INDEX idx_product_questions_org_id ON public.product_questions(organization_id);
CREATE INDEX idx_lead_product_question_answers_lead_id ON public.lead_product_question_answers(lead_id);
CREATE INDEX idx_lead_product_question_answers_product_id ON public.lead_product_question_answers(product_id);

-- Migrate existing data: Create questions from existing key_question columns
INSERT INTO public.product_questions (product_id, organization_id, question_text, position)
SELECT id, organization_id, key_question_1, 0
FROM public.lead_products
WHERE key_question_1 IS NOT NULL AND key_question_1 != '' AND organization_id IS NOT NULL;

INSERT INTO public.product_questions (product_id, organization_id, question_text, position)
SELECT id, organization_id, key_question_2, 1
FROM public.lead_products
WHERE key_question_2 IS NOT NULL AND key_question_2 != '' AND organization_id IS NOT NULL;

INSERT INTO public.product_questions (product_id, organization_id, question_text, position)
SELECT id, organization_id, key_question_3, 2
FROM public.lead_products
WHERE key_question_3 IS NOT NULL AND key_question_3 != '' AND organization_id IS NOT NULL;

-- Migrate existing answers
INSERT INTO public.lead_product_question_answers (lead_id, product_id, question_id, organization_id, answer_text, updated_by, updated_at)
SELECT 
  lpa.lead_id,
  lpa.product_id,
  pq.id,
  lpa.organization_id,
  lpa.answer_1,
  lpa.updated_by,
  lpa.updated_at
FROM public.lead_product_answers lpa
JOIN public.product_questions pq ON pq.product_id = lpa.product_id AND pq.position = 0
WHERE lpa.answer_1 IS NOT NULL AND lpa.answer_1 != '';

INSERT INTO public.lead_product_question_answers (lead_id, product_id, question_id, organization_id, answer_text, updated_by, updated_at)
SELECT 
  lpa.lead_id,
  lpa.product_id,
  pq.id,
  lpa.organization_id,
  lpa.answer_2,
  lpa.updated_by,
  lpa.updated_at
FROM public.lead_product_answers lpa
JOIN public.product_questions pq ON pq.product_id = lpa.product_id AND pq.position = 1
WHERE lpa.answer_2 IS NOT NULL AND lpa.answer_2 != '';

INSERT INTO public.lead_product_question_answers (lead_id, product_id, question_id, organization_id, answer_text, updated_by, updated_at)
SELECT 
  lpa.lead_id,
  lpa.product_id,
  pq.id,
  lpa.organization_id,
  lpa.answer_3,
  lpa.updated_by,
  lpa.updated_at
FROM public.lead_product_answers lpa
JOIN public.product_questions pq ON pq.product_id = lpa.product_id AND pq.position = 2
WHERE lpa.answer_3 IS NOT NULL AND lpa.answer_3 != '';