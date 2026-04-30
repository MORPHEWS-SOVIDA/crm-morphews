
DO $$ BEGIN CREATE TYPE public.financial_entity_type AS ENUM ('cnpj','cpf','projeto','imovel','familia','carteira','centro_operacional','outro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.financial_transaction_type AS ENUM ('receita','despesa','transferencia_entrada','transferencia_saida','taxa','imposto','estorno','ajuste'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.financial_transaction_direction AS ENUM ('inflow','outflow'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.financial_transaction_status AS ENUM ('previsto','pendente_aprovacao','aprovado','realizado','conciliado','cancelado','estornado','vencido','pago_parcial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.financial_difference_reason AS ENUM ('desconto','juros','multa','correcao','pagamento_parcial','erro','ajuste_manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.financial_source AS ENUM ('manual','planilha_importada','venda','nota_fiscal','boleto','extrato_bancario','gateway','webhook','ia','recorrencia'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.financial_risk_level AS ENUM ('baixo','medio','alto','critico'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.financial_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  fiscal_company_id uuid REFERENCES public.fiscal_companies(id) ON DELETE SET NULL,
  name text NOT NULL,
  entity_type public.financial_entity_type NOT NULL DEFAULT 'cnpj',
  document text, responsible_name text, responsible_user_id uuid,
  notes text, color text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_entities_org ON public.financial_entities(organization_id);

CREATE TABLE IF NOT EXISTS public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entity_id uuid REFERENCES public.financial_entities(id) ON DELETE SET NULL,
  name text NOT NULL, code text,
  parent_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  description text, color text,
  is_active boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cost_centers_org ON public.cost_centers(organization_id);

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entity_id uuid REFERENCES public.financial_entities(id) ON DELETE RESTRICT,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  counterparty_name text, description text NOT NULL,
  type public.financial_transaction_type NOT NULL,
  direction public.financial_transaction_direction NOT NULL,
  status public.financial_transaction_status NOT NULL DEFAULT 'previsto',
  expected_amount_cents bigint NOT NULL DEFAULT 0,
  actual_amount_cents bigint,
  difference_amount_cents bigint GENERATED ALWAYS AS (COALESCE(actual_amount_cents,0) - expected_amount_cents) STORED,
  difference_reason public.financial_difference_reason,
  difference_notes text,
  competence_date date, due_date date, expected_payment_date date,
  paid_at timestamptz, reconciled_at timestamptz,
  canceled_at timestamptz, cancellation_reason text,
  payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  payment_method_snapshot jsonb,
  document_number text, invoice_number text, boleto_barcode text, pix_key text,
  bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  sale_id uuid,
  purchase_invoice_id uuid REFERENCES public.purchase_invoices(id) ON DELETE SET NULL,
  account_payable_id uuid REFERENCES public.accounts_payable(id) ON DELETE SET NULL,
  external_reference text,
  source public.financial_source NOT NULL DEFAULT 'manual',
  source_metadata jsonb,
  risk_score smallint NOT NULL DEFAULT 0,
  risk_level public.financial_risk_level NOT NULL DEFAULT 'baixo',
  risk_reasons jsonb,
  requires_review boolean NOT NULL DEFAULT false,
  approved_by uuid, approved_at timestamptz, reconciled_by uuid,
  notes text, tags text[],
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_tx_org_status ON public.financial_transactions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_fin_tx_due ON public.financial_transactions(organization_id, due_date) WHERE status IN ('previsto','aprovado','vencido','pendente_aprovacao');
CREATE INDEX IF NOT EXISTS idx_fin_tx_entity ON public.financial_transactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_bank ON public.financial_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_competence ON public.financial_transactions(organization_id, competence_date);
CREATE INDEX IF NOT EXISTS idx_fin_tx_paid ON public.financial_transactions(organization_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_fin_tx_supplier ON public.financial_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_category ON public.financial_transactions(category_id);

CREATE TABLE IF NOT EXISTS public.financial_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entity_id uuid REFERENCES public.financial_entities(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
  account_payable_id uuid REFERENCES public.accounts_payable(id) ON DELETE CASCADE,
  purchase_invoice_id uuid REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  attachment_type text NOT NULL,
  file_url text NOT NULL, file_name text, mime_type text, file_size bigint,
  file_hash text,
  duplicate_of_id uuid REFERENCES public.financial_attachments(id) ON DELETE SET NULL,
  ocr_text text, extracted_data jsonb,
  uploaded_by uuid, uploaded_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
CREATE INDEX IF NOT EXISTS idx_fin_att_org ON public.financial_attachments(organization_id);
CREATE INDEX IF NOT EXISTS idx_fin_att_hash ON public.financial_attachments(organization_id, file_hash);

CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL, entity_id uuid,
  table_name text NOT NULL, record_id uuid NOT NULL, action text NOT NULL,
  before_data jsonb, after_data jsonb, changed_fields text[],
  user_id uuid, user_email text, ip_address text, user_agent text, reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_audit_org ON public.financial_audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_audit_record ON public.financial_audit_logs(table_name, record_id);

CREATE TABLE IF NOT EXISTS public.financial_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entity_id uuid REFERENCES public.financial_entities(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  description text NOT NULL,
  type public.financial_transaction_type NOT NULL,
  direction public.financial_transaction_direction NOT NULL,
  amount_cents bigint NOT NULL,
  is_variable_amount boolean NOT NULL DEFAULT false,
  periodicity text NOT NULL, due_day smallint,
  start_date date NOT NULL, end_date date, total_occurrences int,
  generated_count int NOT NULL DEFAULT 0,
  generate_days_before smallint NOT NULL DEFAULT 5,
  requires_approval boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  last_generated_at timestamptz, next_due_date date,
  notes text, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_rec_org ON public.financial_recurrences(organization_id, is_active);

CREATE TABLE IF NOT EXISTS public.financial_organization_settings (
  organization_id uuid PRIMARY KEY,
  require_cost_center boolean NOT NULL DEFAULT false,
  require_category boolean NOT NULL DEFAULT true,
  require_proof_above_cents bigint NOT NULL DEFAULT 100000,
  require_approval_above_cents bigint NOT NULL DEFAULT 500000,
  require_approval_for_new_supplier boolean NOT NULL DEFAULT true,
  require_approval_for_bank_change boolean NOT NULL DEFAULT true,
  allow_financial_role_pay boolean NOT NULL DEFAULT true,
  allow_aux_role_create boolean NOT NULL DEFAULT true,
  alert_days_before_due smallint NOT NULL DEFAULT 3,
  default_currency text NOT NULL DEFAULT 'BRL',
  reporting_regime text NOT NULL DEFAULT 'both',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.financial_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_subtype text,
  ADD COLUMN IF NOT EXISTS holder_name text,
  ADD COLUMN IF NOT EXISTS holder_document text,
  ADD COLUMN IF NOT EXISTS balance_date date,
  ADD COLUMN IF NOT EXISTS manual_balance_cents bigint,
  ADD COLUMN IF NOT EXISTS last_reconciliation_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;
CREATE INDEX IF NOT EXISTS idx_bank_accounts_entity ON public.bank_accounts(entity_id);

ALTER TABLE public.accounts_payable
  ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.financial_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount_paid_cents bigint,
  ADD COLUMN IF NOT EXISTS difference_cents bigint,
  ADD COLUMN IF NOT EXISTS difference_reason public.financial_difference_reason,
  ADD COLUMN IF NOT EXISTS difference_notes text,
  ADD COLUMN IF NOT EXISTS risk_score smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_level public.financial_risk_level NOT NULL DEFAULT 'baixo',
  ADD COLUMN IF NOT EXISTS risk_reasons jsonb,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS installment_group_id uuid,
  ADD COLUMN IF NOT EXISTS installment_number smallint,
  ADD COLUMN IF NOT EXISTS total_installments smallint,
  ADD COLUMN IF NOT EXISTS recurrence_id uuid REFERENCES public.financial_recurrences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source public.financial_source NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_payment_date date,
  ADD COLUMN IF NOT EXISTS competence_date date;
CREATE INDEX IF NOT EXISTS idx_payable_entity ON public.accounts_payable(entity_id);
CREATE INDEX IF NOT EXISTS idx_payable_org_status ON public.accounts_payable(organization_id, status);

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.financial_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS risk_level public.financial_risk_level NOT NULL DEFAULT 'baixo',
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_key_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bank_data_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_payment_term_days smallint,
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

ALTER TABLE public.financial_categories
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS is_fixed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_deductible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS affects_dre boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS affects_cashflow boolean NOT NULL DEFAULT true;

ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.financial_entities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS direction public.financial_transaction_direction,
  ADD COLUMN IF NOT EXISTS confidence_score smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconciliation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS matched_transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = _user_id AND organization_id = _org_id)
      OR EXISTS(SELECT 1 FROM public.organization_members WHERE user_id = _user_id AND organization_id = _org_id AND COALESCE(is_active,true) = true);
$$;

CREATE OR REPLACE FUNCTION public.has_financial_admin(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
      SELECT 1 FROM public.organization_members
      WHERE user_id = _user_id AND organization_id = _org_id
        AND COALESCE(is_active,true) = true
        AND role IN ('owner','admin','finance')
    ) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.fn_financial_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action text; v_org uuid; v_record uuid; v_changed text[];
BEGIN
  IF TG_OP = 'INSERT' THEN v_action := 'create'; v_org := NEW.organization_id; v_record := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN v_action := 'update'; v_org := NEW.organization_id; v_record := NEW.id;
    SELECT array_agg(key) INTO v_changed FROM jsonb_each(to_jsonb(NEW)) n WHERE n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key);
  ELSIF TG_OP = 'DELETE' THEN v_action := 'delete'; v_org := OLD.organization_id; v_record := OLD.id;
  END IF;
  INSERT INTO public.financial_audit_logs(organization_id, table_name, record_id, action, before_data, after_data, changed_fields, user_id)
  VALUES (v_org, TG_TABLE_NAME, v_record, v_action,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
    v_changed, auth.uid());
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_audit_fin_tx ON public.financial_transactions;
CREATE TRIGGER trg_audit_fin_tx AFTER INSERT OR UPDATE OR DELETE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.fn_financial_audit();
DROP TRIGGER IF EXISTS trg_audit_payable ON public.accounts_payable;
CREATE TRIGGER trg_audit_payable AFTER INSERT OR UPDATE OR DELETE ON public.accounts_payable FOR EACH ROW EXECUTE FUNCTION public.fn_financial_audit();

CREATE OR REPLACE FUNCTION public.fn_block_delete_realized_tx()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('realizado','conciliado','estornado') THEN
    RAISE EXCEPTION 'Não é permitido excluir lançamento financeiro realizado/conciliado. Use cancelamento.';
  END IF;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS trg_block_delete_realized ON public.financial_transactions;
CREATE TRIGGER trg_block_delete_realized BEFORE DELETE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.fn_block_delete_realized_tx();

DROP TRIGGER IF EXISTS trg_fe_updated ON public.financial_entities;
CREATE TRIGGER trg_fe_updated BEFORE UPDATE ON public.financial_entities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_cc_updated ON public.cost_centers;
CREATE TRIGGER trg_cc_updated BEFORE UPDATE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_ftx_updated ON public.financial_transactions;
CREATE TRIGGER trg_ftx_updated BEFORE UPDATE ON public.financial_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_frec_updated ON public.financial_recurrences;
CREATE TRIGGER trg_frec_updated BEFORE UPDATE ON public.financial_recurrences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_fos_updated ON public.financial_organization_settings;
CREATE TRIGGER trg_fos_updated BEFORE UPDATE ON public.financial_organization_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.financial_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_organization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fe_select" ON public.financial_entities;
CREATE POLICY "fe_select" ON public.financial_entities FOR SELECT TO authenticated USING (public.user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "fe_insert" ON public.financial_entities;
CREATE POLICY "fe_insert" ON public.financial_entities FOR INSERT TO authenticated WITH CHECK (public.has_financial_admin(auth.uid(), organization_id));
DROP POLICY IF EXISTS "fe_update" ON public.financial_entities;
CREATE POLICY "fe_update" ON public.financial_entities FOR UPDATE TO authenticated USING (public.has_financial_admin(auth.uid(), organization_id));
DROP POLICY IF EXISTS "fe_delete" ON public.financial_entities;
CREATE POLICY "fe_delete" ON public.financial_entities FOR DELETE TO authenticated USING (public.has_financial_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "cc_select" ON public.cost_centers;
CREATE POLICY "cc_select" ON public.cost_centers FOR SELECT TO authenticated USING (public.user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "cc_mod" ON public.cost_centers;
CREATE POLICY "cc_mod" ON public.cost_centers FOR ALL TO authenticated USING (public.has_financial_admin(auth.uid(), organization_id)) WITH CHECK (public.has_financial_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "ftx_select" ON public.financial_transactions;
CREATE POLICY "ftx_select" ON public.financial_transactions FOR SELECT TO authenticated USING (public.user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "ftx_insert" ON public.financial_transactions;
CREATE POLICY "ftx_insert" ON public.financial_transactions FOR INSERT TO authenticated WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "ftx_update" ON public.financial_transactions;
CREATE POLICY "ftx_update" ON public.financial_transactions FOR UPDATE TO authenticated USING (public.user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "ftx_delete" ON public.financial_transactions;
CREATE POLICY "ftx_delete" ON public.financial_transactions FOR DELETE TO authenticated USING (public.has_financial_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "fatt_select" ON public.financial_attachments;
CREATE POLICY "fatt_select" ON public.financial_attachments FOR SELECT TO authenticated USING (public.user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "fatt_mod" ON public.financial_attachments;
CREATE POLICY "fatt_mod" ON public.financial_attachments FOR ALL TO authenticated USING (public.user_belongs_to_org(auth.uid(), organization_id)) WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));

DROP POLICY IF EXISTS "fal_select" ON public.financial_audit_logs;
CREATE POLICY "fal_select" ON public.financial_audit_logs FOR SELECT TO authenticated USING (public.has_financial_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "frec_select" ON public.financial_recurrences;
CREATE POLICY "frec_select" ON public.financial_recurrences FOR SELECT TO authenticated USING (public.user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "frec_mod" ON public.financial_recurrences;
CREATE POLICY "frec_mod" ON public.financial_recurrences FOR ALL TO authenticated USING (public.has_financial_admin(auth.uid(), organization_id)) WITH CHECK (public.has_financial_admin(auth.uid(), organization_id));

DROP POLICY IF EXISTS "fos_select" ON public.financial_organization_settings;
CREATE POLICY "fos_select" ON public.financial_organization_settings FOR SELECT TO authenticated USING (public.user_belongs_to_org(auth.uid(), organization_id));
DROP POLICY IF EXISTS "fos_mod" ON public.financial_organization_settings;
CREATE POLICY "fos_mod" ON public.financial_organization_settings FOR ALL TO authenticated USING (public.has_financial_admin(auth.uid(), organization_id)) WITH CHECK (public.has_financial_admin(auth.uid(), organization_id));
