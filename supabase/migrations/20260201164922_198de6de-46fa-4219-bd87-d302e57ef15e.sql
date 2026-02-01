-- Adicionar campos para sistema de revisão de notas NPS
-- ai_original_rating: nota original dada pela IA (preservada mesmo após revisão)
-- classification_source: 'regex', 'ai' ou 'manual'
-- classification_reasoning: explicação da IA sobre a classificação
-- review_requested: se alguém solicitou revisão
-- review_requested_at: quando foi solicitada
-- review_requested_by: quem solicitou
-- review_request_reason: motivo da solicitação
-- final_rating: nota final após revisão (se diferente da original)

ALTER TABLE public.conversation_satisfaction_ratings 
ADD COLUMN IF NOT EXISTS ai_original_rating integer,
ADD COLUMN IF NOT EXISTS classification_source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS classification_reasoning text,
ADD COLUMN IF NOT EXISTS review_requested boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS review_requested_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS review_requested_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS review_request_reason text,
ADD COLUMN IF NOT EXISTS final_rating integer;

-- Migrar dados existentes: se auto_classified é true, a fonte é 'ai'
UPDATE public.conversation_satisfaction_ratings
SET classification_source = 'ai',
    ai_original_rating = rating
WHERE auto_classified = true AND classification_source IS NULL;

-- Se rating existe mas não foi auto_classified, pode ser regex ou manual
UPDATE public.conversation_satisfaction_ratings
SET classification_source = 'regex',
    ai_original_rating = rating
WHERE rating IS NOT NULL AND auto_classified = false AND classification_source IS NULL;

-- Criar índice para buscar revisões pendentes rapidamente
CREATE INDEX IF NOT EXISTS idx_csr_review_requested 
ON public.conversation_satisfaction_ratings(organization_id, review_requested) 
WHERE review_requested = true;

-- Comentários explicativos
COMMENT ON COLUMN public.conversation_satisfaction_ratings.ai_original_rating IS 'Nota original atribuída pela IA/sistema, preservada mesmo após revisão manual';
COMMENT ON COLUMN public.conversation_satisfaction_ratings.classification_source IS 'Origem da classificação: regex (extração direta), ai (classificação por IA), manual (inserção humana)';
COMMENT ON COLUMN public.conversation_satisfaction_ratings.classification_reasoning IS 'Explicação da IA sobre como chegou à nota';
COMMENT ON COLUMN public.conversation_satisfaction_ratings.review_requested IS 'Se um membro da equipe solicitou revisão da nota';
COMMENT ON COLUMN public.conversation_satisfaction_ratings.final_rating IS 'Nota final após revisão manual (quando diferente da original)';