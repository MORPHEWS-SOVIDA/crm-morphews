-- =========================================
-- MIGRATION: WhatsApp Robusto - RLS por Organização + Auto-permissões + Contact-centric
-- =========================================

-- 1) GARANTIR contact_id NA MENSAGEM (já existe, criar index)
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact_id
  ON public.whatsapp_messages (contact_id);

-- 2) VIEW "INBOX" POR ORGANIZAÇÃO (NÃO POR USUÁRIO)
DROP VIEW IF EXISTS public.whatsapp_conversations_view;

CREATE OR REPLACE VIEW public.whatsapp_conversations_view AS
SELECT
  c.*,
  i.name AS channel_name,
  i.provider AS channel_provider,
  i.phone_number AS channel_phone_number
FROM public.whatsapp_conversations c
JOIN public.whatsapp_instances i ON i.id = c.instance_id;

-- 3) RLS: permitir que QUALQUER membro da org VEJA conversas/mensagens da org
-- Remover policies antigas restritivas
DROP POLICY IF EXISTS "Users can view conversations they have access to" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Users can view messages" ON public.whatsapp_messages;

-- Novas policies por organização
CREATE POLICY "whatsapp_conversations_select_by_org"
ON public.whatsapp_conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = whatsapp_conversations.organization_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "whatsapp_messages_select_by_org"
ON public.whatsapp_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = whatsapp_messages.conversation_id
      AND om.user_id = auth.uid()
  )
);

-- 4) FUNÇÃO: garante permissão do usuário em uma instância
CREATE OR REPLACE FUNCTION public.grant_user_instance_access(
  _instance_id uuid,
  _user_id uuid,
  _can_view boolean DEFAULT true,
  _can_send boolean DEFAULT true
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.whatsapp_instance_users (instance_id, user_id, can_view, can_send)
  VALUES (_instance_id, _user_id, _can_view, _can_send)
  ON CONFLICT (instance_id, user_id) DO UPDATE
    SET can_view = EXCLUDED.can_view,
        can_send = EXCLUDED.can_send;
END;
$$;

-- 5) TRIGGER: quando criar instância, dar acesso a todos membros da org
CREATE OR REPLACE FUNCTION public.on_whatsapp_instance_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT user_id
    FROM public.organization_members
    WHERE organization_id = NEW.organization_id
  LOOP
    PERFORM public.grant_user_instance_access(NEW.id, r.user_id, true, true);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_instance_created ON public.whatsapp_instances;
CREATE TRIGGER trg_whatsapp_instance_created
AFTER INSERT ON public.whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.on_whatsapp_instance_created();

-- 6) TRIGGER: quando adicionar membro, dar acesso a todas instâncias da org
CREATE OR REPLACE FUNCTION public.on_org_member_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id AS instance_id
    FROM public.whatsapp_instances
    WHERE organization_id = NEW.organization_id
  LOOP
    PERFORM public.grant_user_instance_access(r.instance_id, NEW.user_id, true, true);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_member_added ON public.organization_members;
CREATE TRIGGER trg_org_member_added
AFTER INSERT ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.on_org_member_added();

-- 7) Garantir unique constraint em whatsapp_instance_users
ALTER TABLE public.whatsapp_instance_users 
DROP CONSTRAINT IF EXISTS whatsapp_instance_users_instance_user_unique;

ALTER TABLE public.whatsapp_instance_users
ADD CONSTRAINT whatsapp_instance_users_instance_user_unique 
UNIQUE (instance_id, user_id);