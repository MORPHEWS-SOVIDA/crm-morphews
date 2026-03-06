
-- Add auto-move columns to organization_funnel_stages
ALTER TABLE public.organization_funnel_stages
  ADD COLUMN IF NOT EXISTS auto_move_after_hours integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auto_move_target_stage_id uuid DEFAULT NULL REFERENCES public.organization_funnel_stages(id) ON DELETE SET NULL;

-- Create function to auto-move stale leads
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
  -- For each stage that has auto-move configured
  FOR stage_rec IN
    SELECT id, name, auto_move_after_hours, auto_move_target_stage_id, organization_id
    FROM organization_funnel_stages
    WHERE auto_move_after_hours IS NOT NULL
      AND auto_move_target_stage_id IS NOT NULL
      AND auto_move_after_hours > 0
  LOOP
    -- Move leads that have been in this stage longer than the configured hours
    -- We use lead_stage_changed_at if available, otherwise updated_at
    UPDATE leads
    SET 
      custom_funnel_stage_id = stage_rec.auto_move_target_stage_id,
      updated_at = now()
    WHERE custom_funnel_stage_id = stage_rec.id
      AND organization_id = stage_rec.organization_id
      AND COALESCE(lead_stage_changed_at, updated_at) < (now() - (stage_rec.auto_move_after_hours || ' hours')::interval);

    GET DIAGNOSTICS moved_count = ROW_COUNT;
    
    IF moved_count > 0 THEN
      RAISE NOTICE 'Auto-moved % leads from stage "%" to target stage', moved_count, stage_rec.name;
    END IF;
  END LOOP;
END;
$$;
