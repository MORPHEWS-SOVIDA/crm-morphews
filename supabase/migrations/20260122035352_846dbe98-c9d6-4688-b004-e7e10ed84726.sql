-- Atualizar função consume_energy para incluir model_used e real_cost_usd
CREATE OR REPLACE FUNCTION public.consume_energy(
  p_organization_id uuid,
  p_bot_id uuid,
  p_conversation_id uuid,
  p_action_type text,
  p_energy_amount integer,
  p_tokens_used integer DEFAULT NULL,
  p_details jsonb DEFAULT NULL,
  p_model_used text DEFAULT NULL,
  p_real_cost_usd numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available_energy integer;
BEGIN
  SELECT (included_energy + bonus_energy - used_energy)
  INTO v_available_energy
  FROM organization_energy
  WHERE organization_id = p_organization_id;
  
  IF v_available_energy IS NULL THEN
    INSERT INTO organization_energy (organization_id, included_energy, bonus_energy, used_energy)
    VALUES (p_organization_id, 10000, 0, 0)
    ON CONFLICT (organization_id) DO NOTHING;
    v_available_energy := 10000;
  END IF;
  
  IF v_available_energy < p_energy_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Energia insuficiente',
      'available_energy', v_available_energy,
      'required_energy', p_energy_amount
    );
  END IF;
  
  UPDATE organization_energy
  SET used_energy = used_energy + p_energy_amount, updated_at = now()
  WHERE organization_id = p_organization_id;
  
  -- Inserir no log com model_used e real_cost_usd
  INSERT INTO energy_usage_log (organization_id, bot_id, conversation_id, action_type, energy_consumed, tokens_used, details, model_used, real_cost_usd)
  VALUES (p_organization_id, p_bot_id, p_conversation_id, p_action_type, p_energy_amount, p_tokens_used, p_details, p_model_used, p_real_cost_usd);
  
  IF p_conversation_id IS NOT NULL THEN
    UPDATE whatsapp_conversations
    SET bot_energy_consumed = COALESCE(bot_energy_consumed, 0) + p_energy_amount,
        bot_messages_count = CASE WHEN p_action_type = 'text_response' THEN COALESCE(bot_messages_count, 0) + 1 ELSE bot_messages_count END
    WHERE id = p_conversation_id;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'energy_consumed', p_energy_amount, 'remaining_energy', v_available_energy - p_energy_amount);
END;
$$;