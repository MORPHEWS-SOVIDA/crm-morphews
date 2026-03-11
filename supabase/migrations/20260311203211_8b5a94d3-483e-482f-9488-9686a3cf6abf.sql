-- Fix trigger: resolve assigned_to (text name) to user_id (uuid) via profiles
CREATE OR REPLACE FUNCTION public.auto_create_followup_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason_id uuid;
  v_reason_name text;
  v_followup_hours int;
  v_schedule_at timestamptz;
  v_user_id uuid;
BEGIN
  -- Only fire when funnel_stage_id actually changes
  IF (TG_OP = 'UPDATE' AND NEW.funnel_stage_id IS NOT NULL 
      AND (OLD.funnel_stage_id IS DISTINCT FROM NEW.funnel_stage_id)) THEN

    -- Check if the new stage has a default follow-up reason configured
    SELECT ofs.default_followup_reason_id, npr.name, npr.followup_hours
    INTO v_reason_id, v_reason_name, v_followup_hours
    FROM organization_funnel_stages ofs
    LEFT JOIN non_purchase_reasons npr ON npr.id = ofs.default_followup_reason_id
    WHERE ofs.id = NEW.funnel_stage_id
      AND ofs.default_followup_reason_id IS NOT NULL;

    -- If a reason is configured, create the follow-up
    IF v_reason_id IS NOT NULL THEN
      -- Schedule time
      IF v_followup_hours IS NOT NULL AND v_followup_hours > 0 THEN
        v_schedule_at := now() + (v_followup_hours || ' hours')::interval;
      ELSE
        v_schedule_at := now();
      END IF;

      -- Resolve assigned_to (text name) to user_id (uuid)
      -- Try matching first_name || ' ' || last_name or first_name alone
      SELECT p.user_id INTO v_user_id
      FROM profiles p
      WHERE p.organization_id = NEW.organization_id
        AND (
          trim(p.first_name || ' ' || coalesce(p.last_name, '')) = NEW.assigned_to
          OR p.first_name = NEW.assigned_to
        )
      LIMIT 1;

      -- If no user found, skip (we can't insert without a valid user_id)
      IF v_user_id IS NULL THEN
        RETURN NEW;
      END IF;

      -- Avoid duplicates
      IF NOT EXISTS (
        SELECT 1 FROM lead_followups
        WHERE lead_id = NEW.id
          AND organization_id = NEW.organization_id
          AND reason = v_reason_name
          AND completed_at IS NULL
      ) THEN
        INSERT INTO lead_followups (
          organization_id,
          lead_id,
          user_id,
          scheduled_at,
          reason,
          source_type,
          source_id,
          notes
        ) VALUES (
          NEW.organization_id,
          NEW.id,
          v_user_id,
          v_schedule_at,
          v_reason_name,
          'auto_stage',
          NEW.funnel_stage_id,
          'Follow-up automático ao entrar na etapa'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
