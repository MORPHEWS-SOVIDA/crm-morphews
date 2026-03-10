-- Fix auto-move automation to use the correct enum type, log exact moved leads, and keep history consistent
CREATE OR REPLACE FUNCTION public.auto_move_stale_leads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stage_rec RECORD;
  lead_rec RECORD;
  initial_profile_id uuid;
  exclude_target_id uuid;
  eligible_targets uuid[];
  moved_count integer;
  target_enum_value public.funnel_stage;
  source_enum_value public.funnel_stage;
  chosen_target uuid;
  chosen_enum public.funnel_stage;
  min_count bigint;
  check_count bigint;
  t uuid;
BEGIN
  FOR stage_rec IN
    SELECT
      id,
      name,
      auto_move_after_hours,
      auto_move_target_stage_id,
      auto_move_use_rotation,
      organization_id,
      enum_value
    FROM public.organization_funnel_stages
    WHERE auto_move_after_hours IS NOT NULL
      AND auto_move_after_hours > 0
      AND (
        auto_move_target_stage_id IS NOT NULL
        OR auto_move_use_rotation = true
      )
  LOOP
    source_enum_value := COALESCE(stage_rec.enum_value, 'unclassified')::public.funnel_stage;

    IF stage_rec.auto_move_use_rotation = true THEN
      moved_count := 0;

      FOR lead_rec IN
        SELECT l.id AS lead_id, l.organization_id AS lead_org_id
        FROM public.leads l
        WHERE l.funnel_stage_id = stage_rec.id
          AND l.organization_id = stage_rec.organization_id
          AND COALESCE(
            (
              SELECT MAX(h.created_at)
              FROM public.lead_stage_history h
              WHERE h.lead_id = l.id
            ),
            l.created_at
          ) < (now() - make_interval(hours => stage_rec.auto_move_after_hours))
      LOOP
        SELECT ssa.profile_id
        INTO initial_profile_id
        FROM public.social_selling_activities ssa
        WHERE ssa.lead_id = lead_rec.lead_id
          AND ssa.activity_type = 'import'
        ORDER BY ssa.created_at ASC
        LIMIT 1;

        IF initial_profile_id IS NOT NULL THEN
          SELECT art.target_stage_id
          INTO exclude_target_id
          FROM public.auto_move_rotation_targets art
          WHERE art.source_stage_id = stage_rec.id
            AND art.social_selling_profile_id = initial_profile_id
          LIMIT 1;
        ELSE
          exclude_target_id := NULL;
        END IF;

        SELECT ARRAY_AGG(art.target_stage_id ORDER BY art.position)
        INTO eligible_targets
        FROM public.auto_move_rotation_targets art
        WHERE art.source_stage_id = stage_rec.id
          AND (exclude_target_id IS NULL OR art.target_stage_id <> exclude_target_id);

        IF eligible_targets IS NOT NULL AND array_length(eligible_targets, 1) > 0 THEN
          chosen_target := NULL;
          min_count := NULL;

          FOREACH t IN ARRAY eligible_targets
          LOOP
            SELECT COUNT(*)
            INTO check_count
            FROM public.leads
            WHERE funnel_stage_id = t
              AND organization_id = stage_rec.organization_id;

            IF min_count IS NULL OR check_count < min_count THEN
              min_count := check_count;
              chosen_target := t;
            END IF;
          END LOOP;

          IF chosen_target IS NOT NULL THEN
            SELECT COALESCE(ofs.enum_value, 'unclassified')::public.funnel_stage
            INTO chosen_enum
            FROM public.organization_funnel_stages ofs
            WHERE ofs.id = chosen_target;

            UPDATE public.leads
            SET funnel_stage_id = chosen_target,
                updated_at = now()
            WHERE id = lead_rec.lead_id;

            INSERT INTO public.lead_stage_history (
              lead_id,
              organization_id,
              stage,
              previous_stage,
              funnel_stage_id,
              reason,
              source
            )
            VALUES (
              lead_rec.lead_id,
              lead_rec.lead_org_id,
              chosen_enum,
              source_enum_value,
              chosen_target,
              'auto_move_rotation',
              'auto_move'
            );

            moved_count := moved_count + 1;
          END IF;
        END IF;
      END LOOP;

      IF moved_count > 0 THEN
        RAISE NOTICE 'Auto-rotated % leads from stage "%"', moved_count, stage_rec.name;
      END IF;
    ELSE
      SELECT COALESCE(ofs.enum_value, 'unclassified')::public.funnel_stage
      INTO target_enum_value
      FROM public.organization_funnel_stages ofs
      WHERE ofs.id = stage_rec.auto_move_target_stage_id;

      WITH moved AS (
        UPDATE public.leads l
        SET funnel_stage_id = stage_rec.auto_move_target_stage_id,
            updated_at = now()
        WHERE l.funnel_stage_id = stage_rec.id
          AND l.organization_id = stage_rec.organization_id
          AND COALESCE(
            (
              SELECT MAX(h.created_at)
              FROM public.lead_stage_history h
              WHERE h.lead_id = l.id
            ),
            l.created_at
          ) < (now() - make_interval(hours => stage_rec.auto_move_after_hours))
        RETURNING l.id, l.organization_id
      )
      INSERT INTO public.lead_stage_history (
        lead_id,
        organization_id,
        stage,
        previous_stage,
        funnel_stage_id,
        reason,
        source
      )
      SELECT
        m.id,
        m.organization_id,
        target_enum_value,
        source_enum_value,
        stage_rec.auto_move_target_stage_id,
        'auto_move_timeout',
        'auto_move'
      FROM moved m;

      GET DIAGNOSTICS moved_count = ROW_COUNT;

      IF moved_count > 0 THEN
        RAISE NOTICE 'Auto-moved % leads from stage "%"', moved_count, stage_rec.name;
      END IF;
    END IF;
  END LOOP;
END;
$$;