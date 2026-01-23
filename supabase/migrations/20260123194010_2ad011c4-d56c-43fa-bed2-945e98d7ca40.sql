-- Drop e recria a função para permitir "roubar" conversa de outro vendedor
CREATE OR REPLACE FUNCTION public.claim_whatsapp_conversation(p_conversation_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status text;
  v_designated_user_id uuid;
  v_assigned_user_id uuid;
  v_org_id uuid;
BEGIN
  -- Get current status, designated user, and assigned user
  SELECT status, designated_user_id, assigned_user_id, organization_id 
  INTO v_current_status, v_designated_user_id, v_assigned_user_id, v_org_id
  FROM whatsapp_conversations 
  WHERE id = p_conversation_id
  FOR UPDATE;

  -- Check if conversation exists
  IF v_current_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Conversa não encontrada');
  END IF;

  -- Se já está atribuída ao mesmo usuário, retorna sucesso silencioso
  IF v_current_status = 'assigned' AND v_assigned_user_id = p_user_id THEN
    RETURN json_build_object('success', true, 'message', 'Conversa já está atribuída a você');
  END IF;

  -- REMOVIDO: bloqueio quando já está assigned
  -- Agora permite "roubar" a conversa (transfere automaticamente)

  -- If autodistributed, only designated user can claim (mantém esta regra)
  IF v_current_status = 'autodistributed' AND v_designated_user_id IS NOT NULL AND v_designated_user_id != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Esta conversa foi designada para outro vendedor');
  END IF;

  -- Registrar histórico se estava atribuída a outro (transferência implícita)
  IF v_current_status = 'assigned' AND v_assigned_user_id IS NOT NULL AND v_assigned_user_id != p_user_id THEN
    INSERT INTO whatsapp_conversation_assignments (
      organization_id,
      conversation_id,
      from_user_id,
      to_user_id,
      action,
      assigned_by,
      notes
    ) VALUES (
      v_org_id,
      p_conversation_id,
      v_assigned_user_id,
      p_user_id,
      'claim_takeover',
      p_user_id,
      'Conversa assumida de outro vendedor'
    );
  END IF;

  -- Update conversation (clear bot handling if was with_bot)
  UPDATE whatsapp_conversations
  SET 
    status = 'assigned',
    assigned_user_id = p_user_id,
    assigned_at = now(),
    handling_bot_id = NULL,
    bot_started_at = NULL,
    updated_at = now()
  WHERE id = p_conversation_id;

  -- Registrar histórico de atribuição
  INSERT INTO whatsapp_conversation_assignments (
    organization_id,
    conversation_id,
    from_user_id,
    to_user_id,
    action,
    assigned_by
  ) VALUES (
    v_org_id,
    p_conversation_id,
    NULL,
    p_user_id,
    CASE 
      WHEN v_current_status = 'with_bot' THEN 'claim_from_bot'
      WHEN v_current_status = 'autodistributed' THEN 'claim_autodistributed'
      ELSE 'claim'
    END,
    p_user_id
  );

  RETURN json_build_object('success', true);
END;
$function$;