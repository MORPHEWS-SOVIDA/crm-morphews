-- Adicionar coluna redistribution_timeout_minutes na tabela whatsapp_instances
-- Esta coluna define após quantos minutos sem resposta uma conversa autodistribuída 
-- deve ser passada para o próximo vendedor no rodízio

ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS redistribution_timeout_minutes integer DEFAULT 5;

COMMENT ON COLUMN public.whatsapp_instances.redistribution_timeout_minutes IS 
'Minutos de timeout para redistribuir conversa não atendida para próximo vendedor no modo auto-distribuição';