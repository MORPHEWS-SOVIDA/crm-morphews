-- Create table to store lead answers to product key questions
CREATE TABLE public.lead_product_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  answer_1 TEXT,
  answer_2 TEXT,
  answer_3 TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, product_id)
);

-- Enable RLS
ALTER TABLE public.lead_product_answers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view lead_product_answers of their org"
ON public.lead_product_answers
FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert lead_product_answers in their org"
ON public.lead_product_answers
FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update lead_product_answers of their org"
ON public.lead_product_answers
FOR UPDATE
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete lead_product_answers of their org"
ON public.lead_product_answers
FOR DELETE
USING (organization_id = get_user_organization_id());

-- Trigger for updated_at
CREATE TRIGGER update_lead_product_answers_updated_at
BEFORE UPDATE ON public.lead_product_answers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();