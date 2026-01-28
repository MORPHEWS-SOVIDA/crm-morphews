
-- Drop and recreate the RPC with additional columns
DROP FUNCTION IF EXISTS public.get_linked_lead_for_conversation(uuid);

CREATE OR REPLACE FUNCTION public.get_linked_lead_for_conversation(p_conversation_id uuid)
RETURNS TABLE (
  lead_id uuid,
  lead_name text,
  lead_stage text,
  lead_instagram text,
  lead_stars integer,
  lead_funnel_stage_id uuid,
  lead_whatsapp text,
  lead_email text
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
    l.stars as lead_stars,
    l.funnel_stage_id as lead_funnel_stage_id,
    l.whatsapp as lead_whatsapp,
    l.email as lead_email
  FROM leads l
  WHERE l.id = v_lead_id
    AND l.organization_id = v_org_id;

END;
$$;
