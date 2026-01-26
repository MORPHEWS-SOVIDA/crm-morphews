
-- Fix consume_energy function to use correct table structure
CREATE OR REPLACE FUNCTION public.consume_energy(
  p_organization_id uuid, 
  p_bot_id uuid, 
  p_conversation_id uuid, 
  p_action_type text, 
  p_energy_amount integer, 
  p_tokens_used integer, 
  p_details jsonb, 
  p_model_used text DEFAULT NULL::text, 
  p_real_cost_usd numeric DEFAULT NULL::numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_energy record;
  v_available_energy integer;
BEGIN
  -- Get current energy balance from organization_energy table
  SELECT 
    included_energy,
    bonus_energy,
    used_energy,
    (COALESCE(included_energy, 0) + COALESCE(bonus_energy, 0) - COALESCE(used_energy, 0)) as available
  INTO v_org_energy
  FROM organization_energy 
  WHERE organization_id = p_organization_id;
  
  IF v_org_energy IS NULL THEN
    -- Create energy record if it doesn't exist
    INSERT INTO organization_energy (organization_id, included_energy, bonus_energy, used_energy)
    VALUES (p_organization_id, 1000, 0, 0)
    ON CONFLICT (organization_id) DO NOTHING;
    
    v_available_energy := 1000;
  ELSE
    v_available_energy := COALESCE(v_org_energy.available, 0);
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
  
  -- Increment used_energy (instead of decrementing balance)
  UPDATE organization_energy 
  SET used_energy = COALESCE(used_energy, 0) + p_energy_amount,
      updated_at = now()
  WHERE organization_id = p_organization_id;
  
  -- Log consumption in energy_usage_log
  INSERT INTO energy_usage_log (
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
$function$;
