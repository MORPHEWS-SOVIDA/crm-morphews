-- Drop and recreate the function with improved handling
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
  v_row_num INTEGER := 0;
  v_max_position INTEGER;
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

  -- STEP 1: Move ALL stages from this org to very high temp positions
  -- Each stage gets a unique temp position based on row number
  FOR stage_id IN 
    SELECT id FROM organization_funnel_stages WHERE organization_id = first_org_id ORDER BY id
  LOOP
    v_row_num := v_row_num + 1;
    UPDATE organization_funnel_stages
    SET position = 10000000 + v_row_num
    WHERE id = stage_id;
  END LOOP;

  -- STEP 2: Apply the new positions from the input array
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

  -- STEP 3: Handle stages NOT in the input array (cloud/trash types)
  -- Cloud stage goes to position 0
  UPDATE organization_funnel_stages
  SET position = 0
  WHERE organization_id = first_org_id
    AND stage_type = 'cloud'
    AND position > 10000000;

  -- Find max position used by funnel stages
  SELECT COALESCE(MAX(position), 0) INTO v_max_position
  FROM organization_funnel_stages 
  WHERE organization_id = first_org_id 
    AND position < 10000000;

  -- For trash stages still at temp positions, assign sequential positions after funnel stages
  v_row_num := 0;
  FOR stage_id IN 
    SELECT id FROM organization_funnel_stages 
    WHERE organization_id = first_org_id 
      AND stage_type = 'trash'
      AND position > 10000000
    ORDER BY id
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