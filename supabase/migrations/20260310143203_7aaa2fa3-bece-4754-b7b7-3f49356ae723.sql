-- Make funnel auto-move run every 5 minutes instead of once per hour
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = 17) THEN
    PERFORM cron.unschedule(17);
  END IF;

  PERFORM cron.schedule(
    'auto-move-stale-leads-every-5-minutes',
    '*/5 * * * *',
    'SELECT public.auto_move_stale_leads()'
  );
END
$$;