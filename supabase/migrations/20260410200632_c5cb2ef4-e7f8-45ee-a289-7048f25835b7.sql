
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
  v_cloud_num INTEGER := 0;
BEGIN
  IF p_stages IS NULL OR jsonb_array_length(p_stages) = 0 THEN
    RAISE EXCEPTION 'Nenhuma etapa fornecida para reordenação';
  END IF;

  -- Get org_id from first stage
  SELECT organization_id INTO first_org_id
  FROM organization_funnel_stages
  WHERE id = (p_stages->0->>'id')::UUID;

  IF first_org_id IS NULL THEN
    RAISE EXCEPTION 'Organização não encontrada para etapa %', (p_stages->0->>'id');
  END IF;

  -- Check user permission
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = first_org_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Usuário não tem permissão para esta organização';
  END IF;

  -- Defer the unique constraint so we can freely update positions
  SET CONSTRAINTS organization_funnel_stages_organization_id_position_key DEFERRED;

  -- First: move ALL stages of this org to large negative positions to avoid any conflicts
  UPDATE organization_funnel_stages
  SET position = -1000 - (ROW_NUMBER() OVER (ORDER BY position))::integer
  WHERE organization_id = first_org_id;

  -- Apply the new positions from the input array
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

  -- Find max position used from input
  SELECT COALESCE(MAX((elem->>'position')::integer), 0) INTO v_max_position
  FROM jsonb_array_elements(p_stages) elem;

  -- Handle cloud stages NOT in the input - give each a unique position starting at 0
  FOR stage_id IN
    SELECT s.id FROM organization_funnel_stages s
    WHERE s.organization_id = first_org_id
      AND s.stage_type = 'cloud'
      AND s.id NOT IN (SELECT (elem->>'id')::UUID FROM jsonb_array_elements(p_stages) elem)
    ORDER BY s.id
  LOOP
    UPDATE organization_funnel_stages
    SET position = v_max_position + v_row_num + 1
    WHERE id = stage_id;
    v_row_num := v_row_num + 1;
  END LOOP;

  -- Trash stages get sequential positions after everything else
  FOR stage_id IN
    SELECT s.id FROM organization_funnel_stages s
    WHERE s.organization_id = first_org_id
      AND s.stage_type = 'trash'
      AND s.id NOT IN (SELECT (elem->>'id')::UUID FROM jsonb_array_elements(p_stages) elem)
    ORDER BY s.id
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
