-- Versão simples: dois triggers específicos
DROP TRIGGER IF EXISTS trg_ftx_audit_user ON public.financial_transactions;
DROP TRIGGER IF EXISTS trg_fe_audit_user ON public.financial_entities;
DROP FUNCTION IF EXISTS public.fn_set_financial_audit_user() CASCADE;

-- Para financial_transactions (tem created_by + updated_by)
CREATE OR REPLACE FUNCTION public.fn_ftx_audit_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_ftx_audit_user
BEFORE INSERT OR UPDATE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.fn_ftx_audit_user();

-- Para financial_entities (só created_by)
CREATE OR REPLACE FUNCTION public.fn_fe_audit_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_fe_audit_user
BEFORE INSERT OR UPDATE ON public.financial_entities
FOR EACH ROW EXECUTE FUNCTION public.fn_fe_audit_user();