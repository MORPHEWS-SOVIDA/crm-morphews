-- Atualiza a função claim_whatsapp_conversation para também atualizar responsável do lead
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
  v_lead_id uuid;
  v_previous_lead_responsible uuid;
BEGIN
  -- Get current status, designated user, assigned user and lead_id
  SELECT status, designated_user_id, assigned_user_id, organization_id, lead_id 
  INTO v_current_status, v_designated_user_id, v_assigned_user_id, v_org_id, v_lead_id
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
      'Conversa assumida de outro vendedor via WhatsApp'
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

  -- Registrar histórico de atribuição na conversa
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

  -- ========== NOVA LÓGICA: Atualizar responsável do lead ==========
  IF v_lead_id IS NOT NULL THEN
    -- Buscar responsável atual do lead
    SELECT user_id INTO v_previous_lead_responsible
    FROM lead_responsibles
    WHERE lead_id = v_lead_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- Só atualizar se o responsável for diferente
    IF v_previous_lead_responsible IS NULL OR v_previous_lead_responsible != p_user_id THEN
      -- Adicionar novo responsável (não remove o antigo, apenas adiciona)
      INSERT INTO lead_responsibles (lead_id, user_id, organization_id)
      VALUES (v_lead_id, p_user_id, v_org_id)
      ON CONFLICT DO NOTHING;

      -- Registrar no histórico de transferências do lead
      INSERT INTO lead_ownership_transfers (
        organization_id,
        lead_id,
        from_user_id,
        to_user_id,
        transferred_by,
        transfer_reason,
        notes
      ) VALUES (
        v_org_id,
        v_lead_id,
        v_previous_lead_responsible,
        p_user_id,
        p_user_id,
        'atendimento_whatsapp',
        CASE 
          WHEN v_current_status = 'assigned' AND v_assigned_user_id IS NOT NULL 
          THEN 'Conversa assumida de outro vendedor via Chat WhatsApp'
          WHEN v_current_status = 'with_bot'
          THEN 'Conversa assumida do robô via Chat WhatsApp'
          ELSE 'Conversa assumida via Chat WhatsApp'
        END
      );
    END IF;
  END IF;

  RETURN json_build_object('success', true);
END;
$function$;