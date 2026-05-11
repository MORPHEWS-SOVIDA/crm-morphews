-- 1) New column to track when the lead entered its current funnel stage
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz;

-- 2) Trigger function: bump stage_changed_at when funnel_stage_id changes
CREATE OR REPLACE FUNCTION public.touch_lead_stage_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stage_changed_at IS NULL THEN
      NEW.stage_changed_at := COALESCE(NEW.updated_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.funnel_stage_id IS DISTINCT FROM OLD.funnel_stage_id THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_lead_stage_changed_at ON public.leads;
CREATE TRIGGER trg_touch_lead_stage_changed_at
BEFORE INSERT OR UPDATE OF funnel_stage_id ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.touch_lead_stage_changed_at();

-- 3) Backfill from latest lead_stage_history entry per lead
WITH latest AS (
  SELECT DISTINCT ON (lead_id) lead_id, created_at
  FROM public.lead_stage_history
  ORDER BY lead_id, created_at DESC
)
UPDATE public.leads l
SET stage_changed_at = COALESCE(latest.created_at, l.updated_at, l.created_at)
FROM latest
WHERE l.id = latest.lead_id
  AND l.stage_changed_at IS NULL;

-- For leads without any history entry, fall back to updated_at/created_at
UPDATE public.leads
SET stage_changed_at = COALESCE(updated_at, created_at)
WHERE stage_changed_at IS NULL;

-- Helpful index for the alert query (filtered by org)
CREATE INDEX IF NOT EXISTS idx_leads_org_stage_changed_at
  ON public.leads (organization_id, stage_changed_at);