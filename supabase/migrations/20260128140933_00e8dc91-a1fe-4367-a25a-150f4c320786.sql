-- Fix: consume_energy was reading 'energy_balance' but the column is 'ai_energy_balance'
-- Also check if 'energy_limit' column exists (if not, skip it)

CREATE OR REPLACE FUNCTION public.consume_energy(
  p_organization_id uuid,
  p_bot_id uuid,
  p_conversation_id uuid,
  p_action_type text,
  p_energy_amount integer,
  p_tokens_used integer,
  p_details jsonb,
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
  -- Get current energy balance (using correct column name)
  SELECT COALESCE(ai_energy_balance, 0) INTO v_available_energy
  FROM public.organizations 
  WHERE id = p_organization_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found', 'available_energy', 0);
  END IF;
  
  -- Check if enough energy
  IF v_available_energy < p_energy_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient energy',
      'available_energy', v_available_energy,
      'required_energy', p_energy_amount
    );
  END IF;
  
  -- Deduct energy
  UPDATE public.organizations 
  SET ai_energy_balance = COALESCE(ai_energy_balance, 0) - p_energy_amount,
      updated_at = now()
  WHERE id = p_organization_id;
  
  -- Log consumption
  INSERT INTO public.ai_energy_consumption (
    organization_id, bot_id, conversation_id, action_type, 
    energy_consumed, tokens_used, details, model_used, real_cost_usd
  ) VALUES (
    p_organization_id, p_bot_id, p_conversation_id, p_action_type,
    p_energy_amount, p_tokens_used, p_details, p_model_used, p_real_cost_usd
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'consumed', p_energy_amount,
    'remaining', v_available_energy - p_energy_amount
  );
END;
$$;