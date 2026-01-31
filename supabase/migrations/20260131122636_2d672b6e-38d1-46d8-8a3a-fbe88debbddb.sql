-- Add recipient IE/IM override fields to fiscal invoices (used when editing/resending rejected invoices)
ALTER TABLE public.fiscal_invoices
  ADD COLUMN IF NOT EXISTS recipient_inscricao_estadual TEXT,
  ADD COLUMN IF NOT EXISTS recipient_inscricao_estadual_isento BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recipient_inscricao_municipal TEXT,
  ADD COLUMN IF NOT EXISTS recipient_inscricao_municipal_isento BOOLEAN NOT NULL DEFAULT false;