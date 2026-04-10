
CREATE OR REPLACE FUNCTION public.reorder_funnel_stages(p_stages jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stage_record JSONB;
  stage_id UUID;
  new_position INTEGER;
  first_org_id UUID;
  v_max_position INTEGER;
  v_row_num INTEGER := 0;
  v_temp_base INTEGER := 900000;
  v_temp_counter INTEGER := 0;
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

  SET CONSTRAINTS organization_funnel_stages_organization_id_position_key DEFERRED;

  -- Step 1: Move ALL stages to unique high temporary positions to clear all conflicts
  FOR stage_id IN
    SELECT s.id FROM organization_funnel_stages s
    WHERE s.organization_id = first_org_id
    ORDER BY s.position
  LOOP
    v_temp_counter := v_temp_counter + 1;
    UPDATE organization_funnel_stages
    SET position = v_temp_base + v_temp_counter
    WHERE id = stage_id;
  END LOOP;

  -- Step 2: Apply the requested positions from the input array
  FOR stage_record IN SELECT * FROM jsonb_array_elements(p_stages)
  LOOP
    stage_id := (stage_record->>'id')::UUID;
    new_position := (stage_record->>'position')::INTEGER;

    UPDATE organization_funnel_stages
    SET position = new_position
    WHERE id = stage_id
      AND organization_id = first_org_id;
  END LOOP;

  -- Step 3: Find max position from input
  SELECT COALESCE(MAX((elem->>'position')::integer), 0) INTO v_max_position
  FROM jsonb_array_elements(p_stages) elem;

  -- Step 4: Assign remaining stages (not in input) sequential positions after max
  FOR stage_id IN
    SELECT s.id FROM organization_funnel_stages s
    WHERE s.organization_id = first_org_id
      AND s.position >= v_temp_base
    ORDER BY s.stage_type, s.position
  LOOP
    v_row_num := v_row_num + 1;
    UPDATE organization_funnel_stages
    SET position = v_max_position + v_row_num
    WHERE id = stage_id;
  END LOOP;

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$function$;
