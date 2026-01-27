-- Remover o índice único antigo que restringe a 1 conversa por org + phone
DROP INDEX IF EXISTS public.idx_whatsapp_conv_org_phone;

-- Criar novo índice único permitindo 1 conversa por org + phone + instance
CREATE UNIQUE INDEX idx_whatsapp_conv_org_phone_instance 
ON public.whatsapp_conversations (organization_id, phone_number, instance_id);

-- Também criar índice para chat_id por instância (se precisar)
DROP INDEX IF EXISTS public.whatsapp_conversations_org_chat_id_uidx;
CREATE UNIQUE INDEX whatsapp_conversations_org_chat_id_instance_uidx 
ON public.whatsapp_conversations (organization_id, chat_id, instance_id) 
WHERE (chat_id IS NOT NULL);