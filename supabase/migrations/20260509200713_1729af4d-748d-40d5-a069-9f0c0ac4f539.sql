
CREATE TABLE IF NOT EXISTS public.virtual_account_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  virtual_account_id UUID NOT NULL,
  old_balance_cents BIGINT NOT NULL,
  new_balance_cents BIGINT NOT NULL,
  old_pending_cents BIGINT NOT NULL,
  new_pending_cents BIGINT NOT NULL,
  drift_balance_cents BIGINT GENERATED ALWAYS AS (new_balance_cents - old_balance_cents) STORED,
  drift_pending_cents BIGINT GENERATED ALWAYS AS (new_pending_cents - old_pending_cents) STORED,
  triggered_by TEXT NOT NULL DEFAULT 'auto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vaal_account ON public.virtual_account_audit_log(virtual_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vaal_drift ON public.virtual_account_audit_log(created_at DESC) WHERE drift_balance_cents <> 0 OR drift_pending_cents <> 0;

ALTER TABLE public.virtual_account_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view audit log" ON public.virtual_account_audit_log;
CREATE POLICY "Super admins can view audit log"
  ON public.virtual_account_audit_log FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.recalc_virtual_account(p_account_id UUID, p_triggered_by TEXT DEFAULT 'auto')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_balance BIGINT;
  v_old_pending BIGINT;
  v_tx_released BIGINT;
  v_tx_pending BIGINT;
  v_pending_withdrawals BIGINT;
  v_new_balance BIGINT;
  v_new_pending BIGINT;
BEGIN
  SELECT balance_cents, pending_balance_cents INTO v_old_balance, v_old_pending
  FROM public.virtual_accounts WHERE id = p_account_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'account_not_found');
  END IF;

  SELECT COALESCE(SUM(net_amount_cents), 0) INTO v_tx_released
  FROM public.virtual_transactions
  WHERE virtual_account_id = p_account_id AND status IN ('released', 'completed');

  SELECT COALESCE(SUM(net_amount_cents), 0) INTO v_tx_pending
  FROM public.virtual_transactions
  WHERE virtual_account_id = p_account_id AND status = 'pending';

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_pending_withdrawals
  FROM public.withdrawal_requests
  WHERE virtual_account_id = p_account_id AND status IN ('pending', 'approved', 'processing');

  v_new_balance := v_tx_released - v_pending_withdrawals;
  v_new_pending := v_tx_pending;

  IF v_old_balance <> v_new_balance OR v_old_pending <> v_new_pending THEN
    UPDATE public.virtual_accounts
       SET balance_cents = v_new_balance,
           pending_balance_cents = v_new_pending,
           updated_at = now()
     WHERE id = p_account_id;

    INSERT INTO public.virtual_account_audit_log
      (virtual_account_id, old_balance_cents, new_balance_cents, old_pending_cents, new_pending_cents, triggered_by)
    VALUES
      (p_account_id, v_old_balance, v_new_balance, v_old_pending, v_new_pending, p_triggered_by);
  END IF;

  RETURN jsonb_build_object(
    'account_id', p_account_id,
    'old_balance_cents', v_old_balance,
    'new_balance_cents', v_new_balance,
    'old_pending_cents', v_old_pending,
    'new_pending_cents', v_new_pending,
    'changed', (v_old_balance <> v_new_balance OR v_old_pending <> v_new_pending)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_all_virtual_accounts(p_triggered_by TEXT DEFAULT 'cron-weekly')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT := 0;
  v_changed INT := 0;
  v_acc RECORD;
  v_result JSONB;
BEGIN
  FOR v_acc IN SELECT id FROM public.virtual_accounts LOOP
    v_total := v_total + 1;
    v_result := public.recalc_virtual_account(v_acc.id, p_triggered_by);
    IF (v_result->>'changed')::boolean THEN
      v_changed := v_changed + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('checked', v_total, 'corrected', v_changed, 'at', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.release_pending_balances_sql()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_total BIGINT;
  v_accounts UUID[];
BEGIN
  WITH to_release AS (
    SELECT id FROM public.virtual_transactions
    WHERE status = 'pending' AND release_at IS NOT NULL AND release_at <= now()
    FOR UPDATE
  ), updated AS (
    UPDATE public.virtual_transactions vt
       SET status = 'released', released_at = now()
      FROM to_release tr
     WHERE vt.id = tr.id
    RETURNING vt.virtual_account_id, vt.net_amount_cents
  )
  SELECT COUNT(*), COALESCE(SUM(net_amount_cents),0), ARRAY_AGG(DISTINCT virtual_account_id)
    INTO v_count, v_total, v_accounts FROM updated;

  IF v_accounts IS NOT NULL THEN
    PERFORM public.recalc_virtual_account(a, 'release-cron') FROM unnest(v_accounts) AS a;
  END IF;

  RETURN jsonb_build_object('released_count', v_count, 'total_released_cents', v_total, 'at', now());
END;
$$;
