-- Adicionar colunas Evolution na tabela whatsapp_instances
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS evolution_instance_id text,
ADD COLUMN IF NOT EXISTS evolution_api_token text,
ADD COLUMN IF NOT EXISTS evolution_webhook_configured boolean DEFAULT false;

-- Índice para buscar por instance_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_evolution_instance_id 
ON public.whatsapp_instances(evolution_instance_id) WHERE evolution_instance_id IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.whatsapp_instances.evolution_instance_id IS 'Nome da instância no Evolution API';
COMMENT ON COLUMN public.whatsapp_instances.evolution_api_token IS 'Token individual da instância (opcional)';
COMMENT ON COLUMN public.whatsapp_instances.evolution_webhook_configured IS 'Se o webhook já foi configurado no Evolution';