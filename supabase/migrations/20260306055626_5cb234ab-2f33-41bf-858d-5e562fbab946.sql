-- 1. Add nps_pending flag to track conversations needing NPS send
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS nps_pending boolean DEFAULT false;

-- 2. Create the auto-close function that runs via pg_cron (zero cost)
CREATE OR REPLACE FUNCTION public.auto_close_inactive_conversations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org RECORD;
  v_closed_count int := 0;
  v_nps_count int := 0;
  v_now timestamptz := now();
  v_bot_cutoff timestamptz;
  v_assigned_cutoff timestamptz;
  v_updated int;
BEGIN
  FOR v_org IN 
    SELECT 
      o.id,
      o.name,
      COALESCE(o.auto_close_bot_minutes, 60) as bot_minutes,
      COALESCE(o.auto_close_assigned_minutes, 480) as assigned_minutes,
      o.auto_close_only_business_hours,
      COALESCE(o.auto_close_business_start, '08:00') as biz_start,
      COALESCE(o.auto_close_business_end, '20:00') as biz_end,
      COALESCE(o.satisfaction_survey_enabled, false) as survey_enabled,
      COALESCE(o.satisfaction_survey_on_auto_close, false) as survey_on_close
    FROM organizations o
    WHERE o.auto_close_enabled = true
  LOOP
    IF v_org.auto_close_only_business_hours THEN
      DECLARE
        v_brasilia_time time;
      BEGIN
        v_brasilia_time := (v_now AT TIME ZONE 'America/Sao_Paulo')::time;
        IF v_brasilia_time < v_org.biz_start::time 
           OR v_brasilia_time > v_org.biz_end::time THEN
          CONTINUE;
        END IF;
      END;
    END IF;

    v_bot_cutoff := v_now - (v_org.bot_minutes || ' minutes')::interval;
    v_assigned_cutoff := v_now - (v_org.assigned_minutes || ' minutes')::interval;

    WITH closed AS (
      UPDATE whatsapp_conversations wc
      SET 
        status = 'closed',
        closed_at = v_now,
        nps_pending = (v_org.survey_enabled AND v_org.survey_on_close),
        awaiting_satisfaction_response = false
      FROM whatsapp_instances wi
      WHERE (wc.instance_id = wi.id OR wc.current_instance_id = wi.id)
        AND wi.organization_id = v_org.id
        AND wi.status IN ('active', 'connected')
        AND COALESCE(wi.auto_close_enabled, true) = true
        AND wc.status = 'with_bot'
        AND wc.awaiting_satisfaction_response = false
        AND wc.last_message_at < v_bot_cutoff
      RETURNING wc.id
    )
    SELECT count(*) INTO v_updated FROM closed;
    v_closed_count := v_closed_count + v_updated;
    IF v_org.survey_enabled AND v_org.survey_on_close THEN
      v_nps_count := v_nps_count + v_updated;
    END IF;

    WITH closed AS (
      UPDATE whatsapp_conversations wc
      SET 
        status = 'closed',
        closed_at = v_now,
        nps_pending = (v_org.survey_enabled AND v_org.survey_on_close),
        awaiting_satisfaction_response = false
      FROM whatsapp_instances wi
      WHERE (wc.instance_id = wi.id OR wc.current_instance_id = wi.id)
        AND wi.organization_id = v_org.id
        AND wi.status IN ('active', 'connected')
        AND COALESCE(wi.auto_close_enabled, true) = true
        AND wc.status IN ('assigned', 'pending')
        AND wc.awaiting_satisfaction_response = false
        AND wc.last_message_at < v_assigned_cutoff
      RETURNING wc.id
    )
    SELECT count(*) INTO v_updated FROM closed;
    v_closed_count := v_closed_count + v_updated;
    IF v_org.survey_enabled AND v_org.survey_on_close THEN
      v_nps_count := v_nps_count + v_updated;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'closed', v_closed_count,
    'nps_pending', v_nps_count,
    'timestamp', v_now
  );
END;
$$;