-- Add draft support and full fiscal form fields to fiscal_invoices
ALTER TABLE public.fiscal_invoices
  ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS emission_type text DEFAULT 'own',
  ADD COLUMN IF NOT EXISTS nature_operation text,
  ADD COLUMN IF NOT EXISTS emission_date date,
  ADD COLUMN IF NOT EXISTS emission_time time,
  ADD COLUMN IF NOT EXISTS exit_date date,
  ADD COLUMN IF NOT EXISTS exit_time time,
  ADD COLUMN IF NOT EXISTS tax_regime text,
  ADD COLUMN IF NOT EXISTS purpose text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS presence_indicator text DEFAULT '9',
  -- Customer/Recipient data
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_type text DEFAULT 'juridica',
  ADD COLUMN IF NOT EXISTS recipient_cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS recipient_ie text,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS recipient_is_final_consumer boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS recipient_cep text,
  ADD COLUMN IF NOT EXISTS recipient_state text,
  ADD COLUMN IF NOT EXISTS recipient_city text,
  ADD COLUMN IF NOT EXISTS recipient_city_code text,
  ADD COLUMN IF NOT EXISTS recipient_neighborhood text,
  ADD COLUMN IF NOT EXISTS recipient_street text,
  ADD COLUMN IF NOT EXISTS recipient_number text,
  ADD COLUMN IF NOT EXISTS recipient_complement text,
  -- Transport data
  ADD COLUMN IF NOT EXISTS transport_type text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS freight_responsibility text DEFAULT '9',
  ADD COLUMN IF NOT EXISTS carrier_name text,
  ADD COLUMN IF NOT EXISTS carrier_cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS carrier_ie text,
  ADD COLUMN IF NOT EXISTS carrier_state text,
  ADD COLUMN IF NOT EXISTS carrier_city text,
  ADD COLUMN IF NOT EXISTS carrier_address text,
  ADD COLUMN IF NOT EXISTS vehicle_plate text,
  ADD COLUMN IF NOT EXISTS vehicle_state text,
  ADD COLUMN IF NOT EXISTS vehicle_rntc text,
  ADD COLUMN IF NOT EXISTS volume_quantity integer,
  ADD COLUMN IF NOT EXISTS volume_gross_weight numeric(12,3),
  ADD COLUMN IF NOT EXISTS volume_net_weight numeric(12,3),
  ADD COLUMN IF NOT EXISTS volume_numbering text,
  ADD COLUMN IF NOT EXISTS volume_species text,
  ADD COLUMN IF NOT EXISTS volume_brand text,
  -- Tax calculation
  ADD COLUMN IF NOT EXISTS products_total_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freight_value_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_value_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_expenses_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_cents integer DEFAULT 0,
  -- Additional info
  ADD COLUMN IF NOT EXISTS additional_info text,
  ADD COLUMN IF NOT EXISTS fisco_info text,
  ADD COLUMN IF NOT EXISTS seller_user_id uuid REFERENCES profiles(user_id);

-- Add index for draft invoices
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_draft ON public.fiscal_invoices(organization_id, is_draft) WHERE is_draft = true;

-- Add index for pending invoices (for batch operations)
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_pending ON public.fiscal_invoices(organization_id, status) WHERE status = 'pending';