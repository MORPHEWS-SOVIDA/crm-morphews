
-- Function para criar follow-up automático na fila
CREATE OR REPLACE FUNCTION public.trigger_ai_followup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
  v_lead_id uuid;
  v_trigger_type text;
  v_scheduled_for timestamptz;
BEGIN
  -- Determinar trigger_type e lead_id baseado na tabela
  IF TG_TABLE_NAME = 'sales' THEN
    v_lead_id := NEW.lead_id;
    
    IF NEW.status IN ('completed', 'delivered') AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'delivered')) THEN
      v_trigger_type := 'event_post_sale';
      v_scheduled_for := now() + interval '48 hours';
    ELSIF NEW.status IN ('declined', 'failed') AND (OLD.status IS NULL OR OLD.status NOT IN ('declined', 'failed')) THEN
      v_trigger_type := 'event_payment_declined';
      v_scheduled_for := now() + interval '30 minutes';
    ELSE
      RETURN NEW;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'ecommerce_carts' THEN
    v_lead_id := NEW.lead_id;
    IF NEW.status = 'abandoned' AND (OLD.status IS NULL OR OLD.status != 'abandoned') THEN
      v_trigger_type := 'event_cart_abandon';
      v_scheduled_for := now() + interval '1 hour';
    ELSE
      RETURN NEW;
    END IF;
    
  ELSIF TG_TABLE_NAME = 'leads' THEN
    v_lead_id := NEW.id;
    IF NEW.funnel_stage_id IS DISTINCT FROM OLD.funnel_stage_id THEN
      v_trigger_type := 'event_stage_change';
      v_scheduled_for := now() + interval '15 minutes';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Verificar se Super IA está habilitada
  SELECT ai_followup_config INTO v_config
  FROM organizations
  WHERE id = NEW.organization_id;
  
  IF v_config IS NULL OR NOT (v_config->>'enabled')::boolean THEN
    RETURN NEW;
  END IF;
  
  -- Verificar se esse gatilho está habilitado
  IF NOT COALESCE((v_config->'triggers'->>v_trigger_type)::boolean, false) THEN
    RETURN NEW;
  END IF;

  -- Verificar cooldown (não criar se já existe follow-up recente para esse lead)
  IF EXISTS (
    SELECT 1 FROM ai_followup_queue
    WHERE lead_id = v_lead_id
      AND trigger_type = v_trigger_type
      AND created_at > now() - (COALESCE((v_config->>'cooldown_hours')::int, 24) * interval '1 hour')
      AND status NOT IN ('failed', 'skipped')
  ) THEN
    RETURN NEW;
  END IF;

  -- Inserir na fila
  INSERT INTO ai_followup_queue (
    organization_id, lead_id, trigger_type, status, scheduled_for
  ) VALUES (
    NEW.organization_id, v_lead_id, v_trigger_type, 'pending', v_scheduled_for
  );

  RETURN NEW;
END;
$$;

-- Trigger na tabela sales (pós-venda e pagamento recusado)
DROP TRIGGER IF EXISTS trg_ai_followup_sales ON public.sales;
CREATE TRIGGER trg_ai_followup_sales
  AFTER UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ai_followup();

-- Trigger na tabela leads (mudança de etapa)
DROP TRIGGER IF EXISTS trg_ai_followup_leads ON public.leads;
CREATE TRIGGER trg_ai_followup_leads
  AFTER UPDATE OF funnel_stage_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ai_followup();
