
-- Drop the existing unique constraint that causes reorder failures
ALTER TABLE public.organization_funnel_stages 
DROP CONSTRAINT IF EXISTS organization_funnel_stages_organization_id_position_key;

-- Recreate as DEFERRABLE so it only checks at transaction commit
ALTER TABLE public.organization_funnel_stages
ADD CONSTRAINT organization_funnel_stages_organization_id_position_key 
UNIQUE (organization_id, position) 
DEFERRABLE INITIALLY DEFERRED;

-- Recreate the reorder function to use deferred constraints
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

  -- Handle stages NOT in the input array
  -- Cloud stage goes to position 0
  UPDATE organization_funnel_stages
  SET position = 0
  WHERE organization_id = first_org_id
    AND stage_type = 'cloud'
    AND id NOT IN (SELECT (elem->>'id')::UUID FROM jsonb_array_elements(p_stages) elem);

  -- Find max position used
  SELECT COALESCE(MAX(position), 0) INTO v_max_position
  FROM organization_funnel_stages 
  WHERE organization_id = first_org_id
    AND id IN (SELECT (elem->>'id')::UUID FROM jsonb_array_elements(p_stages) elem);

  -- Trash stages get sequential positions after funnel stages
  FOR stage_id IN 
    SELECT id FROM organization_funnel_stages 
    WHERE organization_id = first_org_id 
      AND stage_type = 'trash'
      AND id NOT IN (SELECT (elem->>'id')::UUID FROM jsonb_array_elements(p_stages) elem)
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

GRANT EXECUTE ON FUNCTION public.reorder_funnel_stages(jsonb) TO authenticated;
