-- ============================================================
-- Mini-Fase 1A — Fechamento: Restrição exclusiva + auditoria de acesso
-- Trava o módulo financeiro à user_id do Thiago na org SOVIDA.
-- Quando o SaaS evoluir, basta trocar a lista interna da função.
-- ============================================================

-- 1) Função de gate: somente thiago@sonatura.com.br tem acesso financeiro,
--    e somente dentro da organização SOVIDA (que representa MORPHEWS hoje).
CREATE OR REPLACE FUNCTION public.has_financial_access(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id = '6fee8f43-5efb-4752-a2ce-a70c8e9e3cd2'::uuid
    AND _org_id = '650b1667-e345-498e-9d41-b963faf824a7'::uuid
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = _user_id
        AND om.organization_id = _org_id
        AND om.is_active = true
    );
$$;

COMMENT ON FUNCTION public.has_financial_access IS
  'Gate exclusivo do módulo financeiro. Hoje libera apenas thiago@sonatura.com.br na org SOVIDA. Para abrir SaaS no futuro, expandir aqui.';

-- 2) Substituir policies das tabelas financeiras NOVAS (não toca em legadas
--    como bank_accounts/suppliers/accounts_payable que continuam servindo
--    o resto do ERP via get_user_organization_id).

-- financial_entities
DROP POLICY IF EXISTS fe_select ON public.financial_entities;
DROP POLICY IF EXISTS fe_insert ON public.financial_entities;
DROP POLICY IF EXISTS fe_update ON public.financial_entities;
DROP POLICY IF EXISTS fe_delete ON public.financial_entities;
CREATE POLICY fe_select ON public.financial_entities FOR SELECT
  USING (has_financial_access(auth.uid(), organization_id));
CREATE POLICY fe_insert ON public.financial_entities FOR INSERT
  WITH CHECK (has_financial_access(auth.uid(), organization_id));
CREATE POLICY fe_update ON public.financial_entities FOR UPDATE
  USING (has_financial_access(auth.uid(), organization_id))
  WITH CHECK (has_financial_access(auth.uid(), organization_id));
CREATE POLICY fe_delete ON public.financial_entities FOR DELETE
  USING (has_financial_access(auth.uid(), organization_id));

-- financial_transactions
DROP POLICY IF EXISTS ftx_select ON public.financial_transactions;
DROP POLICY IF EXISTS ftx_insert ON public.financial_transactions;
DROP POLICY IF EXISTS ftx_update ON public.financial_transactions;
DROP POLICY IF EXISTS ftx_delete ON public.financial_transactions;
CREATE POLICY ftx_select ON public.financial_transactions FOR SELECT
  USING (has_financial_access(auth.uid(), organization_id));
CREATE POLICY ftx_insert ON public.financial_transactions FOR INSERT
  WITH CHECK (has_financial_access(auth.uid(), organization_id));
CREATE POLICY ftx_update ON public.financial_transactions FOR UPDATE
  USING (has_financial_access(auth.uid(), organization_id))
  WITH CHECK (has_financial_access(auth.uid(), organization_id));
CREATE POLICY ftx_delete ON public.financial_transactions FOR DELETE
  USING (has_financial_access(auth.uid(), organization_id));

-- financial_attachments
DROP POLICY IF EXISTS fatt_select ON public.financial_attachments;
DROP POLICY IF EXISTS fatt_mod ON public.financial_attachments;
CREATE POLICY fatt_select ON public.financial_attachments FOR SELECT
  USING (has_financial_access(auth.uid(), organization_id));
CREATE POLICY fatt_mod ON public.financial_attachments FOR ALL
  USING (has_financial_access(auth.uid(), organization_id))
  WITH CHECK (has_financial_access(auth.uid(), organization_id));

-- financial_audit_logs (somente leitura para o Thiago, escrita só via trigger)
DROP POLICY IF EXISTS fal_select ON public.financial_audit_logs;
CREATE POLICY fal_select ON public.financial_audit_logs FOR SELECT
  USING (has_financial_access(auth.uid(), organization_id));

-- cost_centers (tabela compartilhada com restante do ERP — manter acesso
-- atual para legacy, mas adicionar política exclusiva de modificação financeira).
-- Mantemos cc_select/cc_mod existentes — não há impacto pois ninguém além
-- do Thiago será apresentado às telas financeiras; cost_centers já é usado em outros módulos.

-- financial_recurrences / financial_organization_settings já estão sob
-- has_financial_admin — atualizar para has_financial_access:
DROP POLICY IF EXISTS fos_select ON public.financial_organization_settings;
DROP POLICY IF EXISTS fos_mod ON public.financial_organization_settings;
CREATE POLICY fos_select ON public.financial_organization_settings FOR SELECT
  USING (has_financial_access(auth.uid(), organization_id));
CREATE POLICY fos_mod ON public.financial_organization_settings FOR ALL
  USING (has_financial_access(auth.uid(), organization_id))
  WITH CHECK (has_financial_access(auth.uid(), organization_id));

DROP POLICY IF EXISTS frec_select ON public.financial_recurrences;
DROP POLICY IF EXISTS frec_mod ON public.financial_recurrences;
CREATE POLICY frec_select ON public.financial_recurrences FOR SELECT
  USING (has_financial_access(auth.uid(), organization_id));
CREATE POLICY frec_mod ON public.financial_recurrences FOR ALL
  USING (has_financial_access(auth.uid(), organization_id))
  WITH CHECK (has_financial_access(auth.uid(), organization_id));

-- 3) Trigger para auto-marcar status 'vencido' em transactions previstas/aprovadas
--    cuja due_date passou (executado on read seria caro; deixamos para job futuro).
--    Por ora, criamos função utilitária reutilizável.
CREATE OR REPLACE FUNCTION public.fn_mark_overdue_transactions(_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.financial_transactions
  SET status = 'vencido', updated_at = now()
  WHERE organization_id = _org_id
    AND status IN ('previsto','aprovado','pendente_aprovacao')
    AND due_date IS NOT NULL
    AND due_date < CURRENT_DATE;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 4) Helper para registrar pagamento (escreve actual_amount, paid_at,
--    diff e status), respeitando regra de não sobrescrever expected.
CREATE OR REPLACE FUNCTION public.fn_register_payment(
  _transaction_id uuid,
  _actual_amount_cents bigint,
  _paid_at timestamptz DEFAULT now(),
  _difference_reason text DEFAULT NULL,
  _difference_notes text DEFAULT NULL
) RETURNS public.financial_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tx public.financial_transactions;
BEGIN
  SELECT * INTO tx FROM public.financial_transactions WHERE id = _transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transação não encontrada'; END IF;
  IF NOT has_financial_access(auth.uid(), tx.organization_id) THEN
    RAISE EXCEPTION 'Sem permissão financeira';
  END IF;
  IF tx.status IN ('cancelado','estornado') THEN
    RAISE EXCEPTION 'Transação cancelada/estornada não pode ser paga';
  END IF;

  UPDATE public.financial_transactions
  SET actual_amount_cents = _actual_amount_cents,
      difference_amount_cents = _actual_amount_cents - COALESCE(expected_amount_cents,0),
      difference_reason = NULLIF(_difference_reason,'')::financial_difference_reason,
      difference_notes = _difference_notes,
      paid_at = _paid_at,
      status = 'realizado',
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = _transaction_id
  RETURNING * INTO tx;

  RETURN tx;
END;
$$;

-- 5) Helper para cancelamento (exige motivo, nunca apaga).
CREATE OR REPLACE FUNCTION public.fn_cancel_transaction(
  _transaction_id uuid,
  _reason text
) RETURNS public.financial_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tx public.financial_transactions;
BEGIN
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
    RAISE EXCEPTION 'Motivo de cancelamento obrigatório (mínimo 3 caracteres)';
  END IF;
  SELECT * INTO tx FROM public.financial_transactions WHERE id = _transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transação não encontrada'; END IF;
  IF NOT has_financial_access(auth.uid(), tx.organization_id) THEN
    RAISE EXCEPTION 'Sem permissão financeira';
  END IF;

  UPDATE public.financial_transactions
  SET status = 'cancelado',
      canceled_at = now(),
      cancellation_reason = _reason,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = _transaction_id
  RETURNING * INTO tx;

  RETURN tx;
END;
$$;

-- 6) Garantir que criar lançamento sempre marque created_by/updated_by.
CREATE OR REPLACE FUNCTION public.fn_set_financial_audit_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ftx_audit_user ON public.financial_transactions;
CREATE TRIGGER trg_ftx_audit_user
BEFORE INSERT OR UPDATE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.fn_set_financial_audit_user();

DROP TRIGGER IF EXISTS trg_fe_audit_user ON public.financial_entities;
CREATE TRIGGER trg_fe_audit_user
BEFORE INSERT OR UPDATE ON public.financial_entities
FOR EACH ROW EXECUTE FUNCTION public.fn_set_financial_audit_user();