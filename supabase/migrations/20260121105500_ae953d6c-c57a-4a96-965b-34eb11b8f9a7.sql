-- =============================================================================
-- ADICIONAR CAMPO webhook_alias AOS CAMPOS PERSONALIZADOS
-- Para facilitar o auto-mapeamento de webhooks
-- =============================================================================

-- Adicionar coluna webhook_alias à tabela de definições de campos personalizados
ALTER TABLE public.lead_custom_field_definitions 
ADD COLUMN IF NOT EXISTS webhook_alias TEXT DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.lead_custom_field_definitions.webhook_alias IS 'Termo/path que será usado para identificar automaticamente este campo em webhooks (ex: data.subscription.plan.name)';

-- Criar índice para busca pelo alias
CREATE INDEX IF NOT EXISTS idx_custom_field_defs_webhook_alias 
ON public.lead_custom_field_definitions(organization_id, webhook_alias) 
WHERE webhook_alias IS NOT NULL;