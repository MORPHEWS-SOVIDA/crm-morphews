-- Drop existing functions to recreate with updated logic
DROP FUNCTION IF EXISTS public.claim_whatsapp_conversation(uuid, uuid);
DROP FUNCTION IF EXISTS public.reopen_whatsapp_conversation(uuid, uuid);
DROP FUNCTION IF EXISTS public.reopen_whatsapp_conversation(uuid);

-- 6. Update claim_whatsapp_conversation to work with autodistributed status
CREATE OR REPLACE FUNCTION public.claim_whatsapp_conversation(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Update conversation
  UPDATE whatsapp_conversations
  SET 
    status = 'assigned',
    assigned_user_id = p_user_id,
    assigned_at = now(),
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
      WHEN v_current_status = 'autodistributed' THEN 'Atendido após auto-distribuição'
      ELSE 'Atendido da fila pendente'
    END
  );

  RETURN json_build_object('success', true);
END;
$$;

-- 7. Update reopen function to handle autodistribution with new status
CREATE OR REPLACE FUNCTION public.reopen_whatsapp_conversation(
  p_conversation_id uuid,
  p_instance_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_distribution_mode text;
  v_org_id uuid;
  v_next_user uuid;
BEGIN
  -- Get instance info
  SELECT distribution_mode, organization_id 
  INTO v_distribution_mode, v_org_id
  FROM whatsapp_instances
  WHERE id = p_instance_id;

  IF v_distribution_mode = 'auto' THEN
    -- Auto-distribution: get next user via round-robin
    v_next_user := get_next_available_user_for_distribution(p_instance_id, v_org_id);
    
    IF v_next_user IS NOT NULL THEN
      -- Set to autodistributed (NOT assigned)
      UPDATE whatsapp_conversations
      SET 
        status = 'autodistributed',
        designated_user_id = v_next_user,
        designated_at = now(),
        assigned_user_id = NULL,
        assigned_at = NULL,
        closed_at = NULL,
        last_customer_message_at = now(),
        updated_at = now()
      WHERE id = p_conversation_id;
      
      INSERT INTO whatsapp_conversation_assignments (
        conversation_id, organization_id, to_user_id, action, notes
      ) VALUES (
        p_conversation_id, v_org_id, v_next_user, 'autodistributed', 'Reaberto e auto-distribuído'
      );
      
      RETURN json_build_object('success', true, 'status', 'autodistributed', 'designated_user_id', v_next_user);
    END IF;
  END IF;

  -- Default: reopen as pending (manual mode or no available user)
  UPDATE whatsapp_conversations
  SET 
    status = 'pending',
    assigned_user_id = NULL,
    assigned_at = NULL,
    designated_user_id = NULL,
    designated_at = NULL,
    closed_at = NULL,
    last_customer_message_at = now(),
    updated_at = now()
  WHERE id = p_conversation_id;
  
  INSERT INTO whatsapp_conversation_assignments (
    conversation_id, organization_id, action
  ) VALUES (
    p_conversation_id, v_org_id, 'reopened'
  );

  RETURN json_build_object('success', true, 'status', 'pending');
END;
$$;