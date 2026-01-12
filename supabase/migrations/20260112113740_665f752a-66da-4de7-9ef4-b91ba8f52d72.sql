
-- 1. Alterar instance_id para nullable na whatsapp_conversations
ALTER TABLE public.whatsapp_conversations 
  ALTER COLUMN instance_id DROP NOT NULL;

-- 2. Remover a FK CASCADE e criar nova com SET NULL
ALTER TABLE public.whatsapp_conversations 
  DROP CONSTRAINT whatsapp_conversations_instance_id_fkey;

ALTER TABLE public.whatsapp_conversations 
  ADD CONSTRAINT whatsapp_conversations_instance_id_fkey 
  FOREIGN KEY (instance_id) REFERENCES whatsapp_instances(id) ON DELETE SET NULL;

-- 3. Adicionar campos para soft-delete na whatsapp_instances
ALTER TABLE public.whatsapp_instances 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 4. Criar coluna para guardar o nome original da instância na conversa
-- (útil quando a instância for deletada, ainda teremos referência)
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS original_instance_name TEXT DEFAULT NULL;

-- 5. Criar índice para busca por instâncias ativas
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_deleted_at 
  ON public.whatsapp_instances(deleted_at) 
  WHERE deleted_at IS NULL;

-- 6. Atualizar a view de conversas para incluir status da instância
DROP VIEW IF EXISTS whatsapp_conversations_view;

CREATE VIEW whatsapp_conversations_view AS
SELECT 
  c.*,
  l.name as lead_name,
  l.stage as lead_stage,
  l.instagram as lead_instagram,
  i.name as channel_name,
  i.phone_number as channel_phone_number,
  i.is_connected as instance_is_connected,
  i.deleted_at as instance_deleted_at,
  CASE 
    WHEN c.instance_id IS NULL THEN 'deleted'
    WHEN i.deleted_at IS NOT NULL THEN 'deleted'
    WHEN i.is_connected = false THEN 'disconnected'
    ELSE 'connected'
  END as instance_status
FROM whatsapp_conversations c
LEFT JOIN leads l ON c.lead_id = l.id
LEFT JOIN whatsapp_instances i ON c.instance_id = i.id;

-- 7. Função para soft-delete de instância preservando conversas
CREATE OR REPLACE FUNCTION soft_delete_whatsapp_instance(p_instance_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guardar o nome da instância em todas as conversas antes de "deletar"
  UPDATE whatsapp_conversations
  SET original_instance_name = (
    SELECT name FROM whatsapp_instances WHERE id = p_instance_id
  )
  WHERE instance_id = p_instance_id
    AND original_instance_name IS NULL;

  -- Marcar instância como deletada (soft delete)
  UPDATE whatsapp_instances
  SET deleted_at = NOW(),
      is_connected = false,
      status = 'deleted'
  WHERE id = p_instance_id;
END;
$$;
