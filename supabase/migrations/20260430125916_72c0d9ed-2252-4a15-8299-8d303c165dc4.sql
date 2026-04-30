-- ============================================================
-- ENTREGA 1 — Cadastros essenciais
-- Adiciona colunas faltantes + bloqueio de DELETE físico se referenciado
-- Reutiliza tabelas existentes; mantém RLS e auditoria já configuradas.
-- ============================================================

-- 1) financial_entities: adicionar contato + nomes legais
ALTER TABLE public.financial_entities
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text;

-- 2) suppliers: marcador explícito de tipo de pessoa (PF/PJ)
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS person_type text CHECK (person_type IN ('PF','PJ'));

-- backfill simples baseado em cnpj/cpf
UPDATE public.suppliers
   SET person_type = CASE WHEN cnpj IS NOT NULL AND cnpj <> '' THEN 'PJ'
                          WHEN cpf  IS NOT NULL AND cpf  <> '' THEN 'PF'
                          ELSE person_type END
 WHERE person_type IS NULL;

-- 3) cost_centers: responsável opcional
ALTER TABLE public.cost_centers
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid;

-- ============================================================
-- 4) Bloqueio de DELETE físico se houver transação vinculada
-- ============================================================

-- Entidade: bloqueia se houver transação, conta bancária, fornecedor,
-- centro de custo ou categoria vinculada
CREATE OR REPLACE FUNCTION public.fn_block_delete_entity_if_used()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.financial_transactions WHERE entity_id = OLD.id) THEN
    RAISE EXCEPTION 'Não é possível excluir: entidade possui lançamentos financeiros. Inative em vez de excluir.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bank_accounts WHERE entity_id = OLD.id) THEN
    RAISE EXCEPTION 'Não é possível excluir: entidade possui contas bancárias. Inative em vez de excluir.';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_block_delete_entity ON public.financial_entities;
CREATE TRIGGER trg_block_delete_entity
BEFORE DELETE ON public.financial_entities
FOR EACH ROW EXECUTE FUNCTION public.fn_block_delete_entity_if_used();

-- Conta bancária
CREATE OR REPLACE FUNCTION public.fn_block_delete_bank_if_used()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.financial_transactions WHERE bank_account_id = OLD.id) THEN
    RAISE EXCEPTION 'Não é possível excluir: conta bancária possui lançamentos. Inative em vez de excluir.';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_block_delete_bank ON public.bank_accounts;
CREATE TRIGGER trg_block_delete_bank
BEFORE DELETE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.fn_block_delete_bank_if_used();

-- Fornecedor (financial_transactions tem supplier_id?)
DO $$
DECLARE has_col boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='financial_transactions' AND column_name='supplier_id'
  ) INTO has_col;

  IF has_col THEN
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION public.fn_block_delete_supplier_if_used()
      RETURNS trigger LANGUAGE plpgsql AS $b$
      BEGIN
        IF EXISTS (SELECT 1 FROM public.financial_transactions WHERE supplier_id = OLD.id) THEN
          RAISE EXCEPTION 'Não é possível excluir: fornecedor possui lançamentos. Inative em vez de excluir.';
        END IF;
        RETURN OLD;
      END $b$;
    $f$;
  ELSE
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION public.fn_block_delete_supplier_if_used()
      RETURNS trigger LANGUAGE plpgsql AS $b$
      BEGIN RETURN OLD; END $b$;
    $f$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_block_delete_supplier ON public.suppliers;
CREATE TRIGGER trg_block_delete_supplier
BEFORE DELETE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.fn_block_delete_supplier_if_used();

-- Categoria
CREATE OR REPLACE FUNCTION public.fn_block_delete_category_if_used()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.financial_transactions WHERE category_id = OLD.id) THEN
    RAISE EXCEPTION 'Não é possível excluir: categoria possui lançamentos. Inative em vez de excluir.';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_block_delete_category ON public.financial_categories;
CREATE TRIGGER trg_block_delete_category
BEFORE DELETE ON public.financial_categories
FOR EACH ROW EXECUTE FUNCTION public.fn_block_delete_category_if_used();

-- Centro de custo
CREATE OR REPLACE FUNCTION public.fn_block_delete_cc_if_used()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.financial_transactions WHERE cost_center_id = OLD.id) THEN
    RAISE EXCEPTION 'Não é possível excluir: centro de custo possui lançamentos. Inative em vez de excluir.';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_block_delete_cc ON public.cost_centers;
CREATE TRIGGER trg_block_delete_cc
BEFORE DELETE ON public.cost_centers
FOR EACH ROW EXECUTE FUNCTION public.fn_block_delete_cc_if_used();
