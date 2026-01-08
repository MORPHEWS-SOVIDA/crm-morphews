-- Add columns to track standard question associations
ALTER TABLE public.product_questions 
ADD COLUMN IF NOT EXISTS is_standard BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS standard_question_id UUID REFERENCES public.standard_questions(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_product_questions_standard_question_id 
ON public.product_questions(standard_question_id) 
WHERE standard_question_id IS NOT NULL;

COMMENT ON COLUMN public.product_questions.is_standard IS 'Whether this question is linked to a standard question';
COMMENT ON COLUMN public.product_questions.standard_question_id IS 'Reference to the standard question if is_standard is true';