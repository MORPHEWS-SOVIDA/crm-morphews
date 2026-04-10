CREATE OR REPLACE FUNCTION public.get_inactive_leads_for_followup(
  p_organization_id uuid,
  p_inactive_hours int DEFAULT 4,
  p_cooldown_hours int DEFAULT 24,
  p_max_per_lead int DEFAULT 3,
  p_max_results int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  cutoff_time timestamptz;
  cooldown_time timestamptz;
BEGIN
  cutoff_time := now() - (p_inactive_hours || ' hours')::interval;
  cooldown_time := now() - (p_cooldown_hours || ' hours')::interval;

  WITH candidates AS (
    SELECT c.id, c.lead_id, c.contact_name, c.phone_number, c.instance_id,
           c.last_message_at, c.status
    FROM whatsapp_conversations c
    WHERE c.organization_id = p_organization_id
      AND c.status IN ('open', 'with_bot')
      AND c.last_message_at < cutoff_time
      AND c.lead_id IS NOT NULL
    ORDER BY c.last_message_at ASC
    LIMIT p_max_results * 2
  ),
  recent_fups AS (
    SELECT DISTINCT lead_id
    FROM ai_followup_queue
    WHERE lead_id IN (SELECT lead_id FROM candidates)
      AND status IN ('sent', 'sending', 'ready', 'pending')
      AND created_at > cooldown_time
  ),
  sent_counts AS (
    SELECT lead_id, count(*) as cnt
    FROM ai_followup_queue
    WHERE lead_id IN (SELECT lead_id FROM candidates)
      AND status = 'sent'
    GROUP BY lead_id
  ),
  eligible AS (
    SELECT c.*
    FROM candidates c
    WHERE c.lead_id NOT IN (SELECT lead_id FROM recent_fups)
      AND COALESCE((SELECT cnt FROM sent_counts sc WHERE sc.lead_id = c.lead_id), 0) < p_max_per_lead
    LIMIT p_max_results
  )
  SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb), '[]'::jsonb)
  INTO result
  FROM eligible e;

  RETURN result;
END;
$$;