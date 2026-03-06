
-- Table for rotation targets (multiple target stages for auto-move with profile filtering)
CREATE TABLE public.auto_move_rotation_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_stage_id uuid NOT NULL REFERENCES public.organization_funnel_stages(id) ON DELETE CASCADE,
  target_stage_id uuid NOT NULL REFERENCES public.organization_funnel_stages(id) ON DELETE CASCADE,
  social_selling_profile_id uuid REFERENCES public.social_selling_profiles(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_stage_id, target_stage_id)
);

-- RLS
ALTER TABLE public.auto_move_rotation_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage rotation targets for their org"
ON public.auto_move_rotation_targets
FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- Add flag to funnel stages to enable rotation mode
ALTER TABLE public.organization_funnel_stages
  ADD COLUMN IF NOT EXISTS auto_move_use_rotation boolean DEFAULT false;

-- Update the auto-move function to support rotation with social selling profile exclusion
CREATE OR REPLACE FUNCTION public.auto_move_stale_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_rec RECORD;
  lead_rec RECORD;
  target_ids uuid[];
  initial_profile_id uuid;
  exclude_target_id uuid;
  eligible_targets uuid[];
  target_count integer;
  current_target_idx integer;
  moved_count integer;
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
      -- ROTATION MODE: distribute leads across multiple targets, excluding the profile that initially contacted them
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
        -- Find the initial social selling profile that contacted this lead (first activity)
        SELECT ssa.profile_id INTO initial_profile_id
        FROM social_selling_activities ssa
        WHERE ssa.lead_id = lead_rec.lead_id
          AND ssa.activity_type = 'import'
        ORDER BY ssa.created_at ASC
        LIMIT 1;
        
        -- Find the target to exclude (the one linked to the initial profile)
        IF initial_profile_id IS NOT NULL THEN
          SELECT art.target_stage_id INTO exclude_target_id
          FROM auto_move_rotation_targets art
          WHERE art.source_stage_id = stage_rec.id
            AND art.social_selling_profile_id = initial_profile_id;
        ELSE
          exclude_target_id := NULL;
        END IF;
        
        -- Get eligible targets (all rotation targets minus excluded one)
        SELECT ARRAY_AGG(art.target_stage_id ORDER BY art.position)
        INTO eligible_targets
        FROM auto_move_rotation_targets art
        WHERE art.source_stage_id = stage_rec.id
          AND (exclude_target_id IS NULL OR art.target_stage_id != exclude_target_id);
        
        IF eligible_targets IS NOT NULL AND array_length(eligible_targets, 1) > 0 THEN
          target_count := array_length(eligible_targets, 1);
          
          -- Round-robin: pick based on count of leads already in each eligible target (least loaded)
          SELECT eligible_targets[idx] INTO current_target_idx
          FROM (
            SELECT t_id, ROW_NUMBER() OVER (ORDER BY lead_count ASC, t_id) as idx
            FROM (
              SELECT unnest(eligible_targets) as t_id
            ) targets
            LEFT JOIN LATERAL (
              SELECT COUNT(*) as lead_count
              FROM leads ll
              WHERE ll.funnel_stage_id = targets.t_id
                AND ll.organization_id = stage_rec.organization_id
            ) cnt ON true
            ORDER BY lead_count ASC, t_id
            LIMIT 1
          ) least_loaded;
          
          -- If the subquery didn't work, just pick the first eligible
          IF current_target_idx IS NULL THEN
            current_target_idx := eligible_targets[1];
          END IF;
          
          -- Actually, simpler approach: pick the target with fewest leads
          DECLARE
            chosen_target uuid;
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
            
            -- Move the lead
            UPDATE leads SET funnel_stage_id = chosen_target, updated_at = now()
            WHERE id = lead_rec.lead_id;
            
            -- Log in stage history
            INSERT INTO lead_stage_history (lead_id, organization_id, funnel_stage_id, reason, source)
            VALUES (lead_rec.lead_id, lead_rec.lead_org_id, chosen_target, 'auto_move_rotation', 'automation');
            
            moved_count := moved_count + 1;
          END;
        END IF;
      END LOOP;
      
      IF moved_count > 0 THEN
        RAISE NOTICE 'Auto-rotated % leads from stage "%"', moved_count, stage_rec.name;
      END IF;
    ELSE
      -- SIMPLE MODE: move all stale leads to single target
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
        INSERT INTO lead_stage_history (lead_id, organization_id, funnel_stage_id, reason, source)
        SELECT l.id, l.organization_id, stage_rec.auto_move_target_stage_id, 'auto_move_timeout', 'automation'
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
