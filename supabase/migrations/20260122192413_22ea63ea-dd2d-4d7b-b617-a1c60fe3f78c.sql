-- Fix: make reorder_funnel_stages use always-positive temporary positions
-- to avoid any chance of negative positions (and thus CHECK constraint failures)

CREATE OR REPLACE FUNCTION public.reorder_funnel_stages(
  p_stages JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record JSONB;
  stage_id UUID;
  new_position INTEGER;
  first_org_id UUID;
  v_max_pos INTEGER;
  v_temp_base INTEGER;
  v_counter INTEGER := 0;
BEGIN
  IF p_stages IS NULL OR jsonb_array_length(p_stages) = 0 THEN
    RAISE EXCEPTION 'Nenhuma etapa fornecida para reordenação';
  END IF;

  SELECT organization_id INTO first_org_id
  FROM organization_funnel_stages
  WHERE id = (p_stages->0->>'id')::UUID;

  IF first_org_id IS NULL THEN
    RAISE EXCEPTION 'Organização não encontrada para etapa %', (p_stages->0->>'id');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = first_org_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Usuário não tem permissão para esta organização';
  END IF;

  -- Base temporária acima do maior position atual da organização
  SELECT COALESCE(MAX(position), 0) INTO v_max_pos
  FROM organization_funnel_stages
  WHERE organization_id = first_org_id;

  -- Mantém a base em um range seguro de INT4
  v_temp_base := LEAST(v_max_pos + 1000, 2000000000);

  -- 1) mover todas as etapas informadas para posições temporárias (sempre positivas)
  FOR stage_record IN SELECT * FROM jsonb_array_elements(p_stages)
  LOOP
    v_counter := v_counter + 1;
    stage_id := (stage_record->>'id')::UUID;

    UPDATE organization_funnel_stages
    SET position = v_temp_base + v_counter
    WHERE id = stage_id
      AND organization_id = first_org_id;
  END LOOP;

  -- 2) aplicar posições finais
  FOR stage_record IN SELECT * FROM jsonb_array_elements(p_stages)
  LOOP
    stage_id := (stage_record->>'id')::UUID;
    new_position := (stage_record->>'position')::INTEGER;

    IF new_position < 0 THEN
      RAISE EXCEPTION 'Posição inválida: % para etapa %', new_position, stage_id;
    END IF;

    UPDATE organization_funnel_stages
    SET position = new_position
    WHERE id = stage_id
      AND organization_id = first_org_id;
  END LOOP;

  RETURN TRUE;
END;
$$;

-- Ensure it remains callable
GRANT EXECUTE ON FUNCTION public.reorder_funnel_stages(jsonb) TO authenticated;
