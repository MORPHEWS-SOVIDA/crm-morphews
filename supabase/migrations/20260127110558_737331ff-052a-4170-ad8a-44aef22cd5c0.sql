
-- Adicionar colunas para vincular afiliados a storefronts e quizzes
ALTER TABLE public.partner_associations 
ADD COLUMN IF NOT EXISTS linked_storefront_id UUID REFERENCES tenant_storefronts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS linked_quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_partner_associations_storefront ON partner_associations(linked_storefront_id) WHERE linked_storefront_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partner_associations_quiz ON partner_associations(linked_quiz_id) WHERE linked_quiz_id IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN partner_associations.linked_storefront_id IS 'Vínculo com loja específica';
COMMENT ON COLUMN partner_associations.linked_quiz_id IS 'Vínculo com quiz específico';
