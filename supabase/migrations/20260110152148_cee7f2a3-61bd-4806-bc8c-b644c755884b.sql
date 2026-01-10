
-- Criar função RPC SECURITY DEFINER para buscar dados do lead vinculado a uma conversa
-- Isso permite que usuários vejam o lead vinculado à conversa mesmo sem ter acesso direto ao lead via RLS

CREATE OR REPLACE FUNCTION public.get_linked_lead_for_conversation(p_conversation_id uuid)
RETURNS TABLE (
  lead_id uuid,
  lead_name text,
  lead_stage text,
  lead_instagram text,
  lead_stars integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_org_id uuid;
  v_lead_id uuid;
BEGIN
  -- Verificar se o usuário está autenticado
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Pegar a organização do usuário
  SELECT organization_id INTO v_user_org_id
  FROM profiles
  WHERE user_id = auth.uid();

  -- Pegar os dados da conversa
  SELECT c.organization_id, c.lead_id
  INTO v_org_id, v_lead_id
  FROM whatsapp_conversations c
  WHERE c.id = p_conversation_id;

  -- Verificar se a conversa pertence à organização do usuário
  IF v_org_id IS NULL OR v_org_id != v_user_org_id THEN
    RETURN; -- Retorna vazio se não tiver acesso
  END IF;

  -- Se não tem lead vinculado, retornar vazio
  IF v_lead_id IS NULL THEN
    RETURN;
  END IF;

  -- Retornar dados do lead (bypass RLS pois SECURITY DEFINER)
  RETURN QUERY
  SELECT 
    l.id as lead_id,
    l.name as lead_name,
    l.stage::text as lead_stage,
    l.instagram as lead_instagram,
    l.stars as lead_stars
  FROM leads l
  WHERE l.id = v_lead_id
    AND l.organization_id = v_org_id; -- Garantia extra de segurança

END;
$$;

-- Permitir execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.get_linked_lead_for_conversation(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_linked_lead_for_conversation IS 
'Retorna dados do lead vinculado a uma conversa de WhatsApp. 
Usa SECURITY DEFINER para permitir que usuários vejam o lead vinculado 
mesmo quando têm leads_view_only_own restrito, desde que tenham acesso à conversa.';
