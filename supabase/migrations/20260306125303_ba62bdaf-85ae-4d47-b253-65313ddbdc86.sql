
-- Fix auto_move_stale_leads to use correct column names
-- Use lead_stage_history.created_at to determine when lead entered stage
CREATE OR REPLACE FUNCTION public.auto_move_stale_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_rec RECORD;
  moved_count integer;
BEGIN
  FOR stage_rec IN
    SELECT id, name, auto_move_after_hours, auto_move_target_stage_id, organization_id
    FROM organization_funnel_stages
    WHERE auto_move_after_hours IS NOT NULL
      AND auto_move_target_stage_id IS NOT NULL
      AND auto_move_after_hours > 0
  LOOP
    -- Move leads that have been in this stage longer than configured hours
    -- Use the most recent stage history entry to determine when the lead entered this stage
    UPDATE leads l
    SET 
      funnel_stage_id = stage_rec.auto_move_target_stage_id,
      updated_at = now()
    WHERE l.funnel_stage_id = stage_rec.id
      AND l.organization_id = stage_rec.organization_id
      AND (
        -- Check stage history for when lead entered this stage
        SELECT COALESCE(MAX(h.created_at), l.updated_at)
        FROM lead_stage_history h
        WHERE h.lead_id = l.id 
          AND h.funnel_stage_id = stage_rec.id
      ) < (now() - (stage_rec.auto_move_after_hours || ' hours')::interval);

    GET DIAGNOSTICS moved_count = ROW_COUNT;
    
    IF moved_count > 0 THEN
      -- Log the auto-moves in stage history
      INSERT INTO lead_stage_history (lead_id, organization_id, funnel_stage_id, previous_stage, reason, changed_by)
      SELECT l.id, l.organization_id, stage_rec.auto_move_target_stage_id, stage_rec.name, 'auto_move_timeout', '00000000-0000-0000-0000-000000000000'
      FROM leads l
      WHERE l.funnel_stage_id = stage_rec.auto_move_target_stage_id
        AND l.organization_id = stage_rec.organization_id
        AND l.updated_at >= now() - interval '1 minute';
      
      RAISE NOTICE 'Auto-moved % leads from stage "%"', moved_count, stage_rec.name;
    END IF;
  END LOOP;
END;
$$;
