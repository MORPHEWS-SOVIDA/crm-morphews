
DO $$
DECLARE
  r RECORD;
  new_pos INT := 0;
  org_id UUID := '2d272c40-22e9-40e2-8cdc-3be142f61717';
  clientes_eventos_id UUID := 'd2d8cce3-88e0-4c51-9d0b-21bf703c916d';
BEGIN
  SET CONSTRAINTS ALL DEFERRED;
  
  -- First: move all stages to temp high positions
  UPDATE organization_funnel_stages 
  SET position = position + 900000 
  WHERE organization_id = org_id;
  
  -- Now reassign positions in desired order:
  -- Position 0: cloud stage (Sem contato)
  UPDATE organization_funnel_stages SET position = 0 
  WHERE organization_id = org_id AND stage_type = 'cloud';
  
  -- Position 1: Clientes Eventos
  UPDATE organization_funnel_stages SET position = 1 
  WHERE id = clientes_eventos_id;
  
  -- All other funnel stages keep their relative order, starting at position 2
  new_pos := 2;
  FOR r IN 
    SELECT id FROM organization_funnel_stages 
    WHERE organization_id = org_id 
      AND stage_type = 'funnel' 
      AND id != clientes_eventos_id
    ORDER BY position ASC
  LOOP
    UPDATE organization_funnel_stages SET position = new_pos WHERE id = r.id;
    new_pos := new_pos + 1;
  END LOOP;
  
  -- Trash stage at the end
  FOR r IN 
    SELECT id FROM organization_funnel_stages 
    WHERE organization_id = org_id AND stage_type = 'trash'
  LOOP
    UPDATE organization_funnel_stages SET position = new_pos WHERE id = r.id;
    new_pos := new_pos + 1;
  END LOOP;
END $$;
