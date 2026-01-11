-- Create function to get ANY bot for instance (ignoring schedule)
-- Used to determine if instance has a bot configured at all
CREATE OR REPLACE FUNCTION public.get_any_bot_for_instance(p_instance_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bot_id uuid;
BEGIN
  -- Return the highest priority active bot for this instance (regardless of schedule)
  SELECT bot_id INTO v_bot_id
  FROM public.instance_bot_schedules
  WHERE instance_id = p_instance_id
    AND is_active = true
  ORDER BY priority DESC, created_at ASC
  LIMIT 1;
  
  RETURN v_bot_id;
END;
$function$;

-- Also update claim to handle with_bot status
CREATE OR REPLACE FUNCTION public.claim_whatsapp_conversation(p_conversation_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status text;
  v_designated_user_id uuid;
  v_org_id uuid;
BEGIN
  -- Get current status and designated user
  SELECT status, designated_user_id, organization_id 
  INTO v_current_status, v_designated_user_id, v_org_id
  FROM whatsapp_conversations 
  WHERE id = p_conversation_id
  FOR UPDATE;

  -- Check if conversation exists
  IF v_current_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Conversa não encontrada');
  END IF;

  -- If already assigned, reject
  IF v_current_status = 'assigned' THEN
    RETURN json_build_object('success', false, 'error', 'Conversa já está atribuída');
  END IF;

  -- If autodistributed, only designated user can claim
  IF v_current_status = 'autodistributed' AND v_designated_user_id IS NOT NULL AND v_designated_user_id != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Esta conversa foi designada para outro vendedor');
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

  -- Log the claim
  INSERT INTO whatsapp_conversation_assignments (
    conversation_id,
    organization_id,
    from_user_id,
    to_user_id,
    action,
    assigned_by,
    notes
  ) VALUES (
    p_conversation_id,
    v_org_id,
    NULL,
    p_user_id,
    'claimed',
    p_user_id,
    CASE 
      WHEN v_current_status = 'with_bot' THEN 'Assumido do robô'
      WHEN v_current_status = 'autodistributed' THEN 'Atendido após auto-distribuição'
      ELSE 'Atendido da fila pendente'
    END
  );

  RETURN json_build_object('success', true);
END;
$function$;