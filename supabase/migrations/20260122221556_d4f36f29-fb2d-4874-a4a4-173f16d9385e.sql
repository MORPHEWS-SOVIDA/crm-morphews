-- 1) Link direto (estável) do lead para a etapa customizada do tenant
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS funnel_stage_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_funnel_stage_id_fkey'
  ) THEN
    ALTER TABLE public.leads
    ADD CONSTRAINT leads_funnel_stage_id_fkey
    FOREIGN KEY (funnel_stage_id)
    REFERENCES public.organization_funnel_stages(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_org_funnel_stage
  ON public.leads (organization_id, funnel_stage_id);

-- Backfill: usa enum_value atual do lead como ponte (is_default > position)
UPDATE public.leads l
SET funnel_stage_id = COALESCE(
  (
    SELECT s.id
    FROM public.organization_funnel_stages s
    WHERE s.organization_id = l.organization_id
      AND s.enum_value = l.stage
    ORDER BY s.is_default DESC, s.position ASC
    LIMIT 1
  ),
  (
    SELECT s.id
    FROM public.organization_funnel_stages s
    WHERE s.organization_id = l.organization_id
      AND s.stage_type = 'cloud'
    ORDER BY s.is_default DESC, s.position ASC
    LIMIT 1
  )
)
WHERE l.organization_id IS NOT NULL
  AND l.funnel_stage_id IS NULL;

-- 2) Guardar também a etapa exata no histórico (para auditoria e debug)
ALTER TABLE public.lead_stage_history
ADD COLUMN IF NOT EXISTS funnel_stage_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lead_stage_history_funnel_stage_id_fkey'
  ) THEN
    ALTER TABLE public.lead_stage_history
    ADD CONSTRAINT lead_stage_history_funnel_stage_id_fkey
    FOREIGN KEY (funnel_stage_id)
    REFERENCES public.organization_funnel_stages(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead_created
  ON public.lead_stage_history (lead_id, created_at DESC);

UPDATE public.lead_stage_history h
SET funnel_stage_id = (
  SELECT s.id
  FROM public.organization_funnel_stages s
  WHERE s.organization_id = h.organization_id
    AND s.enum_value = h.stage
  ORDER BY s.is_default DESC, s.position ASC
  LIMIT 1
)
WHERE h.funnel_stage_id IS NULL;

-- 3) Sincronização automática entre funnel_stage_id e stage (comportamento do sistema)
CREATE OR REPLACE FUNCTION public.sync_lead_funnel_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_enum public.leads.stage%TYPE;
  v_stage_org uuid;
  v_stage_id uuid;
BEGIN
  -- Se o front setar funnel_stage_id: valida tenant e sincroniza stage (comportamento)
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

    NEW.stage := v_stage_enum;
    RETURN NEW;
  END IF;

  -- Se algum fluxo legado setar stage: escolhe automaticamente a etapa (id) correta do tenant
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
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_funnel_stage ON public.leads;

CREATE TRIGGER trg_sync_lead_funnel_stage
BEFORE INSERT OR UPDATE OF stage, funnel_stage_id, organization_id
ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.sync_lead_funnel_stage();
