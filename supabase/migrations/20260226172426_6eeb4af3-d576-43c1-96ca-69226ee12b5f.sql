
CREATE OR REPLACE FUNCTION public.sync_lead_funnel_stage()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_stage_enum public.leads.stage%TYPE;
  v_stage_org uuid;
  v_stage_id uuid;
BEGIN
  IF NEW.funnel_stage_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.funnel_stage_id IS DISTINCT FROM OLD.funnel_stage_id) THEN

    SELECT s.enum_value, s.organization_id
      INTO v_stage_enum, v_stage_org
    FROM public.organization_funnel_stages s
    WHERE s.id = NEW.funnel_stage_id;

    IF v_stage_org IS NULL THEN
      RAISE EXCEPTION 'Invalid funnel_stage_id %', NEW.funnel_stage_id;
    END IF;

    IF NEW.organization_id IS NOT NULL AND v_stage_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'funnel_stage_id % belongs to org %, but lead org is %', NEW.funnel_stage_id, v_stage_org, NEW.organization_id;
    END IF;

    -- DEFENSIVE: never set stage to NULL; keep current value if enum_value is missing
    IF v_stage_enum IS NOT NULL THEN
      NEW.stage := v_stage_enum;
    ELSE
      NEW.stage := COALESCE(NEW.stage, 'no_contact');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.stage IS DISTINCT FROM OLD.stage OR NEW.funnel_stage_id IS NULL) THEN

    SELECT s.id
      INTO v_stage_id
    FROM public.organization_funnel_stages s
    WHERE s.organization_id = NEW.organization_id
      AND s.enum_value = NEW.stage
    ORDER BY s.is_default DESC, s.position ASC
    LIMIT 1;

    IF v_stage_id IS NULL THEN
      SELECT s.id
        INTO v_stage_id
      FROM public.organization_funnel_stages s
      WHERE s.organization_id = NEW.organization_id
        AND s.stage_type = 'cloud'
      ORDER BY s.is_default DESC, s.position ASC
      LIMIT 1;
    END IF;

    NEW.funnel_stage_id := v_stage_id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;
