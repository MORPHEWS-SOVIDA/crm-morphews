-- Fix: Improved reorder_funnel_stages function that handles unique constraint properly
-- The issue is that positions can clash when not all funnel stages are being reordered

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
  v_counter INTEGER := 0;
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

  -- STEP 1: Move ALL stages from this org to very high temp positions (negative approach won't work due to CHECK constraint)
  -- Use a large offset based on row number to ensure uniqueness during temp phase
  UPDATE organization_funnel_stages
  SET position = position + 10000000 + (
    (SELECT COUNT(*) FROM organization_funnel_stages s2 
     WHERE s2.organization_id = first_org_id 
       AND s2.id <= organization_funnel_stages.id)
  )
  WHERE organization_id = first_org_id;

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

  -- STEP 3: Stages NOT in the input array but still at temp positions need cleanup
  -- These are cloud/trash stages - restore them to their expected positions
  -- Cloud should be 0, Trash should be 99
  UPDATE organization_funnel_stages
  SET position = 0
  WHERE organization_id = first_org_id
    AND stage_type = 'cloud'
    AND position > 10000000;

  -- For trash, find a safe position (99 or higher, not conflicting)
  UPDATE organization_funnel_stages
  SET position = GREATEST(99, (
    SELECT COALESCE(MAX(position), 0) + 1 
    FROM organization_funnel_stages 
    WHERE organization_id = first_org_id 
      AND position < 10000000
  ))
  WHERE organization_id = first_org_id
    AND stage_type = 'trash'
    AND position > 10000000;

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;