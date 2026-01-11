-- 1) Add missing columns used by auto-distribution logic
ALTER TABLE public.whatsapp_conversations
ADD COLUMN IF NOT EXISTS designated_user_id uuid;

ALTER TABLE public.whatsapp_conversations
ADD COLUMN IF NOT EXISTS designated_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_designated_user_id
ON public.whatsapp_conversations (designated_user_id);

-- 2) Fix bot schedule resolver to use America/Sao_Paulo as default reference
CREATE OR REPLACE FUNCTION public.get_active_bot_for_instance(
  p_instance_id uuid,
  p_current_time time without time zone DEFAULT ((now() at time zone 'America/Sao_Paulo')::time),
  p_current_day integer DEFAULT (EXTRACT(dow FROM (now() at time zone 'America/Sao_Paulo')::date))::integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bot_id uuid;
BEGIN
  SELECT bot_id INTO v_bot_id
  FROM public.instance_bot_schedules
  WHERE instance_id = p_instance_id
    AND is_active = true
    AND p_current_day = ANY(days_of_week)
    AND (
      -- Caso normal: start < end (ex: 08:00 - 18:00)
      (start_time <= end_time AND p_current_time >= start_time AND p_current_time <= end_time)
      OR
      -- Caso overnight: start > end (ex: 18:00 - 08:00)
      (start_time > end_time AND (p_current_time >= start_time OR p_current_time <= end_time))
    )
  ORDER BY priority DESC, created_at ASC
  LIMIT 1;

  RETURN v_bot_id;
END;
$function$;