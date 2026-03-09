
-- Fix auto_move_stale_leads: populate the required `stage` column in lead_stage_history
-- The bug: INSERT into lead_stage_history was missing the `stage` enum column (NOT NULL),
-- causing the entire transaction to fail and no leads to be moved.

CREATE OR REPLACE FUNCTION public.auto_move_stale_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_rec RECORD;
  lead_rec RECORD;
  initial_profile_id uuid;
  exclude_target_id uuid;
  eligible_targets uuid[];
  target_count integer;
  moved_count integer;
  target_enum_value text;
BEGIN
  FOR stage_rec IN
    SELECT id, name, auto_move_after_hours, auto_move_target_stage_id, auto_move_use_rotation, organization_id
    FROM organization_funnel_stages
    WHERE auto_move_after_hours IS NOT NULL
      AND auto_move_after_hours > 0
      AND (
        auto_move_target_stage_id IS NOT NULL
        OR auto_move_use_rotation = true
      )
  LOOP
    IF stage_rec.auto_move_use_rotation = true THEN
      -- ROTATION MODE
      moved_count := 0;
      
      FOR lead_rec IN
        SELECT l.id as lead_id, l.organization_id as lead_org_id
        FROM leads l
        WHERE l.funnel_stage_id = stage_rec.id
          AND l.organization_id = stage_rec.organization_id
          AND (
            SELECT COALESCE(MAX(h.created_at), l.created_at)
            FROM lead_stage_history h
            WHERE h.lead_id = l.id
          ) < (now() - (stage_rec.auto_move_after_hours || ' hours')::interval)
      LOOP
        SELECT ssa.profile_id INTO initial_profile_id
        FROM social_selling_activities ssa
        WHERE ssa.lead_id = lead_rec.lead_id
          AND ssa.activity_type = 'import'
        ORDER BY ssa.created_at ASC
        LIMIT 1;
        
        IF initial_profile_id IS NOT NULL THEN
          SELECT art.target_stage_id INTO exclude_target_id
          FROM auto_move_rotation_targets art
          WHERE art.source_stage_id = stage_rec.id
            AND art.social_selling_profile_id = initial_profile_id;
        ELSE
          exclude_target_id := NULL;
        END IF;
        
        SELECT ARRAY_AGG(art.target_stage_id ORDER BY art.position)
        INTO eligible_targets
        FROM auto_move_rotation_targets art
        WHERE art.source_stage_id = stage_rec.id
          AND (exclude_target_id IS NULL OR art.target_stage_id != exclude_target_id);
        
        IF eligible_targets IS NOT NULL AND array_length(eligible_targets, 1) > 0 THEN
          DECLARE
            chosen_target uuid;
            chosen_enum text;
            min_count bigint := 999999999;
            check_count bigint;
            t uuid;
          BEGIN
            FOREACH t IN ARRAY eligible_targets
            LOOP
              SELECT COUNT(*) INTO check_count FROM leads WHERE funnel_stage_id = t AND organization_id = stage_rec.organization_id;
              IF check_count < min_count THEN
                min_count := check_count;
                chosen_target := t;
              END IF;
            END LOOP;
            
            -- Get the enum_value for the chosen target stage
            SELECT COALESCE(ofs.enum_value, 'unclassified') INTO chosen_enum
            FROM organization_funnel_stages ofs
            WHERE ofs.id = chosen_target;
            
            -- Move the lead
            UPDATE leads SET funnel_stage_id = chosen_target, updated_at = now()
            WHERE id = lead_rec.lead_id;
            
            -- Log in stage history (include required stage enum column)
            INSERT INTO lead_stage_history (lead_id, organization_id, stage, funnel_stage_id, reason, source)
            VALUES (lead_rec.lead_id, lead_rec.lead_org_id, chosen_enum::lead_stage, chosen_target, 'auto_move_rotation', 'automation');
            
            moved_count := moved_count + 1;
          END;
        END IF;
      END LOOP;
      
      IF moved_count > 0 THEN
        RAISE NOTICE 'Auto-rotated % leads from stage "%"', moved_count, stage_rec.name;
      END IF;
    ELSE
      -- SIMPLE MODE: get the enum_value for the target stage
      SELECT COALESCE(ofs.enum_value, 'unclassified') INTO target_enum_value
      FROM organization_funnel_stages ofs
      WHERE ofs.id = stage_rec.auto_move_target_stage_id;

      -- Move all stale leads to single target
      UPDATE leads l
      SET 
        funnel_stage_id = stage_rec.auto_move_target_stage_id,
        updated_at = now()
      WHERE l.funnel_stage_id = stage_rec.id
        AND l.organization_id = stage_rec.organization_id
        AND (
          SELECT COALESCE(MAX(h.created_at), l.created_at)
          FROM lead_stage_history h
          WHERE h.lead_id = l.id
        ) < (now() - (stage_rec.auto_move_after_hours || ' hours')::interval);

      GET DIAGNOSTICS moved_count = ROW_COUNT;
      
      IF moved_count > 0 THEN
        -- Log history for all moved leads (include required stage column)
        INSERT INTO lead_stage_history (lead_id, organization_id, stage, funnel_stage_id, reason, source)
        SELECT l.id, l.organization_id, target_enum_value::lead_stage, stage_rec.auto_move_target_stage_id, 'auto_move_timeout', 'automation'
        FROM leads l
        WHERE l.funnel_stage_id = stage_rec.auto_move_target_stage_id
          AND l.organization_id = stage_rec.organization_id
          AND l.updated_at >= now() - interval '1 minute';
        
        RAISE NOTICE 'Auto-moved % leads from stage "%"', moved_count, stage_rec.name;
      END IF;
    END IF;
  END LOOP;
END;
$$;
