-- =====================================================================
-- FASE 1A.1 — Endurecimento da fundação financeira (corrigida)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. financial_organization_settings — adicionar display name e plano
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='financial_organization_settings' AND column_name='financial_display_name') THEN
    ALTER TABLE public.financial_organization_settings
      ADD COLUMN financial_display_name text,
      ADD COLUMN financial_plan text NOT NULL DEFAULT 'STANDARD',
      ADD COLUMN is_financial_enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN default_entity_id uuid,
      ADD COLUMN created_by uuid,
      ADD COLUMN updated_by uuid;
  END IF;
END $$;

-- garantir RLS
ALTER TABLE public.financial_organization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fos_select_financial_access" ON public.financial_organization_settings;
CREATE POLICY "fos_select_financial_access"
  ON public.financial_organization_settings FOR SELECT
  USING (public.has_financial_access(auth.uid(), organization_id));

DROP POLICY IF EXISTS "fos_insert_financial_access" ON public.financial_organization_settings;
CREATE POLICY "fos_insert_financial_access"
  ON public.financial_organization_settings FOR INSERT
  WITH CHECK (public.has_financial_access(auth.uid(), organization_id));

DROP POLICY IF EXISTS "fos_update_financial_access" ON public.financial_organization_settings;
CREATE POLICY "fos_update_financial_access"
  ON public.financial_organization_settings FOR UPDATE
  USING (public.has_financial_access(auth.uid(), organization_id));

-- Seed/upsert MORPHEWS
INSERT INTO public.financial_organization_settings (organization_id, financial_display_name, financial_plan, is_financial_enabled)
VALUES ('650b1667-e345-498e-9d41-b963faf824a7', 'MORPHEWS', 'MASTER', true)
ON CONFLICT (organization_id) DO UPDATE
  SET financial_display_name = 'MORPHEWS',
      financial_plan = 'MASTER',
      is_financial_enabled = true,
      updated_at = now();

-- ---------------------------------------------------------------------
-- 2. Escopo financeiro nas tabelas legadas
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='financial_categories' AND column_name='scope') THEN
    ALTER TABLE public.financial_categories
      ADD COLUMN scope text NOT NULL DEFAULT 'general',
      ADD COLUMN entity_id uuid,
      ADD COLUMN is_financial_enabled boolean NOT NULL DEFAULT true,
      ADD COLUMN created_by uuid,
      ADD COLUMN updated_by uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cost_centers' AND column_name='scope') THEN
    ALTER TABLE public.cost_centers
      ADD COLUMN scope text NOT NULL DEFAULT 'general',
      ADD COLUMN is_financial_enabled boolean NOT NULL DEFAULT true,
      ADD COLUMN created_by uuid,
      ADD COLUMN updated_by uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_accounts' AND column_name='scope') THEN
    ALTER TABLE public.bank_accounts
      ADD COLUMN scope text NOT NULL DEFAULT 'general',
      ADD COLUMN is_financial_enabled boolean NOT NULL DEFAULT true,
      ADD COLUMN created_by uuid,
      ADD COLUMN updated_by uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='scope') THEN
    ALTER TABLE public.suppliers
      ADD COLUMN scope text NOT NULL DEFAULT 'general',
      ADD COLUMN is_financial_enabled boolean NOT NULL DEFAULT true,
      ADD COLUMN created_by uuid,
      ADD COLUMN updated_by uuid;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.financial_bank_accounts_view AS
SELECT b.*
FROM public.bank_accounts b
WHERE b.is_active = true
  AND b.is_financial_enabled = true
  AND b.scope IN ('financial','general');

-- ---------------------------------------------------------------------
-- 3. Trigger de validação de status
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validate_financial_transaction_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'realizado' THEN
    IF NEW.bank_account_id IS NULL THEN RAISE EXCEPTION 'bank_account_id é obrigatório quando status = realizado'; END IF;
    IF NEW.paid_at IS NULL THEN RAISE EXCEPTION 'paid_at é obrigatório quando status = realizado'; END IF;
    IF NEW.actual_amount_cents IS NULL THEN RAISE EXCEPTION 'actual_amount_cents é obrigatório quando status = realizado'; END IF;
  END IF;

  IF NEW.status = 'conciliado' THEN
    IF NEW.bank_account_id IS NULL THEN RAISE EXCEPTION 'bank_account_id é obrigatório quando status = conciliado'; END IF;
    IF NEW.paid_at IS NULL THEN RAISE EXCEPTION 'paid_at é obrigatório quando status = conciliado'; END IF;
    IF NEW.actual_amount_cents IS NULL THEN RAISE EXCEPTION 'actual_amount_cents é obrigatório quando status = conciliado'; END IF;
    IF NEW.bank_transaction_id IS NULL THEN RAISE EXCEPTION 'bank_transaction_id é obrigatório quando status = conciliado'; END IF;
    IF NEW.reconciled_at IS NULL THEN RAISE EXCEPTION 'reconciled_at é obrigatório quando status = conciliado'; END IF;
  END IF;

  IF NEW.status = 'cancelado' THEN
    IF NEW.cancellation_reason IS NULL OR length(trim(NEW.cancellation_reason)) < 3 THEN
      RAISE EXCEPTION 'cancellation_reason precisa ter pelo menos 3 caracteres quando status = cancelado';
    END IF;
    IF NEW.canceled_at IS NULL THEN NEW.canceled_at := now(); END IF;
  END IF;

  IF NEW.status IN ('realizado','conciliado','pago_parcial')
     AND NEW.actual_amount_cents IS NOT NULL
     AND NEW.actual_amount_cents <> NEW.expected_amount_cents
     AND NEW.difference_reason IS NULL THEN
    RAISE EXCEPTION 'difference_reason é obrigatório quando actual_amount_cents (%) difere de expected_amount_cents (%)',
      NEW.actual_amount_cents, NEW.expected_amount_cents;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.expected_amount_cents IS DISTINCT FROM OLD.expected_amount_cents THEN
    RAISE EXCEPTION 'expected_amount_cents é imutável (era %, tentou %).', OLD.expected_amount_cents, NEW.expected_amount_cents;
  END IF;

  IF NEW.actual_amount_cents IS NOT NULL THEN
    NEW.difference_amount_cents := NEW.actual_amount_cents - NEW.expected_amount_cents;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_ftx_status ON public.financial_transactions;
CREATE TRIGGER trg_validate_ftx_status
  BEFORE INSERT OR UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_financial_transaction_status();

CREATE OR REPLACE FUNCTION public.fn_protect_ftx_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('realizado','conciliado','cancelado','estornado') THEN
    RAISE EXCEPTION 'Lançamento com status % não pode ser deletado fisicamente. Use cancelamento.', OLD.status;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_ftx_delete ON public.financial_transactions;
CREATE TRIGGER trg_protect_ftx_delete
  BEFORE DELETE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_ftx_delete();

-- ---------------------------------------------------------------------
-- 4. Auditoria automática genérica
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_financial_audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid; v_entity uuid; v_record_id uuid;
  v_before jsonb; v_after jsonb; v_changed text[];
  v_user uuid; v_email text;
BEGIN
  v_user := auth.uid();
  BEGIN SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  EXCEPTION WHEN OTHERS THEN v_email := NULL; END;

  IF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD); v_after := NULL;
    v_record_id := (to_jsonb(OLD)->>'id')::uuid;
    v_org := NULLIF(to_jsonb(OLD)->>'organization_id','')::uuid;
    v_entity := NULLIF(to_jsonb(OLD)->>'entity_id','')::uuid;
  ELSIF TG_OP = 'INSERT' THEN
    v_before := NULL; v_after := to_jsonb(NEW);
    v_record_id := (to_jsonb(NEW)->>'id')::uuid;
    v_org := NULLIF(to_jsonb(NEW)->>'organization_id','')::uuid;
    v_entity := NULLIF(to_jsonb(NEW)->>'entity_id','')::uuid;
  ELSE
    v_before := to_jsonb(OLD); v_after := to_jsonb(NEW);
    v_record_id := (to_jsonb(NEW)->>'id')::uuid;
    v_org := NULLIF(to_jsonb(NEW)->>'organization_id','')::uuid;
    v_entity := NULLIF(to_jsonb(NEW)->>'entity_id','')::uuid;
    SELECT array_agg(key) INTO v_changed
      FROM jsonb_each(v_after) a
      WHERE a.value IS DISTINCT FROM (v_before->a.key);
  END IF;

  INSERT INTO public.financial_audit_logs (
    organization_id, entity_id, table_name, record_id, action,
    before_data, after_data, changed_fields, user_id, user_email, created_at
  ) VALUES (
    v_org, v_entity, TG_TABLE_NAME, v_record_id, TG_OP,
    v_before, v_after, v_changed, v_user, v_email, now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'financial_transactions','financial_entities','financial_attachments',
    'bank_accounts','suppliers','financial_categories','cost_centers'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_financial_audit ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_financial_audit
      AFTER INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.fn_financial_audit_trigger()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_set_audit_user_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    BEGIN NEW.created_by := COALESCE(NEW.created_by, auth.uid()); EXCEPTION WHEN OTHERS THEN END;
  END IF;
  BEGIN NEW.updated_by := auth.uid(); EXCEPTION WHEN OTHERS THEN END;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'financial_transactions','financial_entities','financial_attachments',
    'bank_accounts','suppliers','financial_categories','cost_centers',
    'financial_organization_settings'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_audit_user ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_set_audit_user
      BEFORE INSERT OR UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.fn_set_audit_user_columns()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 5. fn_register_payment com bank_account_id obrigatório
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_register_payment(uuid, bigint, timestamptz, text, text);
DROP FUNCTION IF EXISTS public.fn_register_payment(uuid, uuid, bigint, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.fn_register_payment(
  _transaction_id uuid,
  _bank_account_id uuid,
  _actual_amount_cents bigint,
  _paid_at timestamptz DEFAULT now(),
  _difference_reason text DEFAULT NULL,
  _difference_notes text DEFAULT NULL
) RETURNS public.financial_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx public.financial_transactions;
  v_bank_org uuid;
BEGIN
  IF _bank_account_id IS NULL THEN
    RAISE EXCEPTION 'bank_account_id é obrigatório para registrar pagamento';
  END IF;
  IF _actual_amount_cents IS NULL THEN
    RAISE EXCEPTION 'actual_amount_cents é obrigatório';
  END IF;

  SELECT * INTO v_tx FROM public.financial_transactions WHERE id = _transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação % não encontrada', _transaction_id;
  END IF;

  IF NOT public.has_financial_access(auth.uid(), v_tx.organization_id) THEN
    RAISE EXCEPTION 'Sem acesso financeiro a esta organização';
  END IF;

  SELECT organization_id INTO v_bank_org FROM public.bank_accounts WHERE id = _bank_account_id;
  IF v_bank_org IS NULL THEN
    RAISE EXCEPTION 'Conta bancária % não encontrada', _bank_account_id;
  END IF;
  IF v_bank_org <> v_tx.organization_id THEN
    RAISE EXCEPTION 'Conta bancária pertence a outra organização';
  END IF;

  IF v_tx.status IN ('realizado','conciliado','cancelado','estornado') THEN
    RAISE EXCEPTION 'Transação já está em status % e não pode receber pagamento', v_tx.status;
  END IF;

  IF _actual_amount_cents <> v_tx.expected_amount_cents AND _difference_reason IS NULL THEN
    RAISE EXCEPTION 'difference_reason é obrigatório quando valor realizado difere do previsto';
  END IF;

  UPDATE public.financial_transactions
     SET status = 'realizado',
         bank_account_id = _bank_account_id,
         actual_amount_cents = _actual_amount_cents,
         paid_at = _paid_at,
         difference_reason = _difference_reason::public.financial_difference_reason,
         difference_notes = _difference_notes
   WHERE id = _transaction_id
   RETURNING * INTO v_tx;

  RETURN v_tx;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_register_payment(uuid, uuid, bigint, timestamptz, text, text) TO authenticated;