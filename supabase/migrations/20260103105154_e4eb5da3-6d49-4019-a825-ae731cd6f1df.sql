-- =====================================================
-- PAYMENT METHODS ENHANCEMENT FOR BANK RECONCILIATION
-- =====================================================

-- Create ENUM for payment categories
CREATE TYPE public.payment_category AS ENUM (
  'cash',
  'pix',
  'card_machine',
  'payment_link',
  'ecommerce',
  'boleto_prepaid',
  'boleto_postpaid',
  'boleto_installment',
  'gift'
);

-- Create ENUM for installment payment flow
CREATE TYPE public.installment_flow AS ENUM (
  'anticipation',
  'receive_per_installment'
);

-- Create ENUM for transaction types
CREATE TYPE public.card_transaction_type AS ENUM (
  'debit',
  'credit_cash',
  'credit_installment',
  'credit_predate',
  'pix'
);

-- Create ENUM for card brands
CREATE TYPE public.card_brand AS ENUM (
  'visa',
  'master',
  'elo',
  'amex',
  'banricompras'
);

-- Create table for reusable bank destinations (dropdown)
CREATE TABLE public.payment_bank_destinations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, normalized_name)
);

-- Create table for reusable CNPJ destinations (dropdown)
CREATE TABLE public.payment_cnpj_destinations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  normalized_cnpj text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, normalized_cnpj)
);

-- Create table for reusable cost centers (dropdown)
CREATE TABLE public.payment_cost_centers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, normalized_name)
);

-- Create table for reusable acquirers/operators (dropdown)
CREATE TABLE public.payment_acquirers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, normalized_name)
);

-- Add new columns to payment_methods
ALTER TABLE public.payment_methods 
  ADD COLUMN IF NOT EXISTS category public.payment_category,
  ADD COLUMN IF NOT EXISTS installment_flow public.installment_flow,
  ADD COLUMN IF NOT EXISTS bank_destination_id uuid REFERENCES public.payment_bank_destinations(id),
  ADD COLUMN IF NOT EXISTS cnpj_destination_id uuid REFERENCES public.payment_cnpj_destinations(id),
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.payment_cost_centers(id),
  ADD COLUMN IF NOT EXISTS acquirer_id uuid REFERENCES public.payment_acquirers(id),
  ADD COLUMN IF NOT EXISTS fee_fixed_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_transaction_data boolean DEFAULT false;

-- Create table for payment method transaction type fees
CREATE TABLE public.payment_method_transaction_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_method_id uuid NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  transaction_type public.card_transaction_type NOT NULL,
  fee_percentage numeric(5,2) NOT NULL DEFAULT 0,
  fee_fixed_cents integer NOT NULL DEFAULT 0,
  settlement_days integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(payment_method_id, transaction_type)
);

-- Add transaction data columns to sale_installments for bank reconciliation
ALTER TABLE public.sale_installments
  ADD COLUMN IF NOT EXISTS transaction_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS card_brand public.card_brand,
  ADD COLUMN IF NOT EXISTS transaction_type public.card_transaction_type,
  ADD COLUMN IF NOT EXISTS nsu_cv text,
  ADD COLUMN IF NOT EXISTS acquirer_id uuid REFERENCES public.payment_acquirers(id),
  ADD COLUMN IF NOT EXISTS fee_percentage numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount_cents integer;

-- Enable RLS on new tables
ALTER TABLE public.payment_bank_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_cnpj_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_acquirers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_method_transaction_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_bank_destinations
CREATE POLICY "Users can view bank destinations of their org" 
  ON public.payment_bank_destinations FOR SELECT 
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage bank destinations" 
  ON public.payment_bank_destinations FOR ALL 
  USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id))
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

-- RLS Policies for payment_cnpj_destinations
CREATE POLICY "Users can view cnpj destinations of their org" 
  ON public.payment_cnpj_destinations FOR SELECT 
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage cnpj destinations" 
  ON public.payment_cnpj_destinations FOR ALL 
  USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id))
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

-- RLS Policies for payment_cost_centers
CREATE POLICY "Users can view cost centers of their org" 
  ON public.payment_cost_centers FOR SELECT 
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage cost centers" 
  ON public.payment_cost_centers FOR ALL 
  USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id))
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

-- RLS Policies for payment_acquirers
CREATE POLICY "Users can view acquirers of their org" 
  ON public.payment_acquirers FOR SELECT 
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage acquirers" 
  ON public.payment_acquirers FOR ALL 
  USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id))
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

-- RLS Policies for payment_method_transaction_fees
CREATE POLICY "Users can view transaction fees of their org" 
  ON public.payment_method_transaction_fees FOR SELECT 
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage transaction fees" 
  ON public.payment_method_transaction_fees FOR ALL 
  USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id))
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

-- Function to normalize text for comparison (uppercase, no accents, no special chars)
CREATE OR REPLACE FUNCTION public.normalize_text_for_comparison(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT upper(regexp_replace(
    translate(input, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
    '[^a-zA-Z0-9]', '', 'g'
  ));
$$;

-- Function to normalize CNPJ (only digits)
CREATE OR REPLACE FUNCTION public.normalize_cnpj(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(input, '[^0-9]', '', 'g');
$$;