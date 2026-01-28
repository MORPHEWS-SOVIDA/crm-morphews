-- Adicionar campos para auditoria de encerramento sem NPS
ALTER TABLE public.whatsapp_conversations
ADD COLUMN IF NOT EXISTS skip_nps_at timestamptz,
ADD COLUMN IF NOT EXISTS skip_nps_by uuid REFERENCES public.profiles(user_id),
ADD COLUMN IF NOT EXISTS skip_nps_reason text;

-- Adicionar campo para marcar se a nota foi classificada automaticamente pelo sistema
ALTER TABLE public.conversation_satisfaction_ratings
ADD COLUMN IF NOT EXISTS auto_classified boolean DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN public.whatsapp_conversations.skip_nps_at IS 'Quando a conversa foi encerrada sem enviar pesquisa NPS';
COMMENT ON COLUMN public.whatsapp_conversations.skip_nps_by IS 'Quem optou por encerrar sem NPS';
COMMENT ON COLUMN public.whatsapp_conversations.skip_nps_reason IS 'Motivo opcional do encerramento sem NPS';
COMMENT ON COLUMN public.conversation_satisfaction_ratings.auto_classified IS 'Se a nota foi classificada automaticamente pelo sistema (true) ou manualmente (false)';