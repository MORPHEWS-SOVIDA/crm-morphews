-- 1. Dropar a constraint antiga
ALTER TABLE public.whatsapp_conversations DROP CONSTRAINT IF EXISTS whatsapp_conversations_status_check;

-- 2. Atualizar dados existentes: 'open' → 'assigned' (se tem assigned_user_id) ou 'pending'
UPDATE public.whatsapp_conversations 
SET status = CASE 
  WHEN assigned_user_id IS NOT NULL THEN 'assigned'
  ELSE 'pending'
END
WHERE status = 'open';

-- 3. Criar nova constraint com os valores corretos
ALTER TABLE public.whatsapp_conversations 
ADD CONSTRAINT whatsapp_conversations_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'assigned'::text, 'closed'::text]));