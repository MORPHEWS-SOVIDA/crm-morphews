-- Adicionar coluna para rastrear quem enviou a mensagem (usuário do sistema)
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS sent_by_user_id uuid REFERENCES auth.users(id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_by_user_id 
ON public.whatsapp_messages(sent_by_user_id);

-- Comentário para documentação
COMMENT ON COLUMN public.whatsapp_messages.sent_by_user_id IS 'ID do usuário do sistema que enviou esta mensagem (apenas para mensagens outbound)';