-- Fix consume_energy to use the correct credit tables (organization_energy + energy_usage_log)
-- This prevents runtime errors and ensures correct credit accounting.

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
  v_included integer;
  v_bonus integer;
  v_used integer;
  v_reset_at timestamptz;
  v_available integer;
  v_new_used integer;
  v_next_reset timestamptz;
BEGIN
  IF p_energy_amount IS NULL OR p_energy_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid energy amount');
  END IF;

  -- Lock row for consistent accounting
  SELECT included_energy, bonus_energy, used_energy, reset_at
    INTO v_included, v_bonus, v_used, v_reset_at
  FROM public.organization_energy
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_next_reset := (date_trunc('month', now()) + interval '1 month');
    INSERT INTO public.organization_energy (
      organization_id,
      included_energy,
      bonus_energy,
      used_energy,
      reset_at,
      created_at,
      updated_at
    ) VALUES (
      p_organization_id,
      0,
      0,
      0,
      v_next_reset,
      now(),
      now()
    )
    RETURNING included_energy, bonus_energy, used_energy, reset_at
      INTO v_included, v_bonus, v_used, v_reset_at;
  END IF;

  -- Reset monthly counter if needed
  IF v_reset_at IS NOT NULL AND v_reset_at <= now() THEN
    v_used := 0;
    v_reset_at := (date_trunc('month', now()) + interval '1 month');

    UPDATE public.organization_energy
      SET used_energy = v_used,
          reset_at = v_reset_at,
          updated_at = now()
    WHERE organization_id = p_organization_id;
  END IF;

  v_available := COALESCE(v_included, 0) + COALESCE(v_bonus, 0) - COALESCE(v_used, 0);

  IF v_available < p_energy_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient energy',
      'available_energy', GREATEST(v_available, 0),
      'required_energy', p_energy_amount
    );
  END IF;

  v_new_used := COALESCE(v_used, 0) + p_energy_amount;

  UPDATE public.organization_energy
    SET used_energy = v_new_used,
        updated_at = now()
  WHERE organization_id = p_organization_id;

  INSERT INTO public.energy_usage_log (
    id,
    organization_id,
    bot_id,
    conversation_id,
    action_type,
    energy_consumed,
    tokens_used,
    details,
    created_at,
    model_used,
    real_cost_usd
  ) VALUES (
    gen_random_uuid(),
    p_organization_id,
    p_bot_id,
    p_conversation_id,
    p_action_type,
    p_energy_amount,
    p_tokens_used,
    COALESCE(p_details, '{}'::jsonb),
    now(),
    p_model_used,
    p_real_cost_usd
  );

  RETURN jsonb_build_object(
    'success', true,
    'consumed', p_energy_amount,
    'remaining', (COALESCE(v_included, 0) + COALESCE(v_bonus, 0) - v_new_used)
  );
END;
$$;