-- Create delivery_status enum for standardized delivery outcomes
CREATE TYPE delivery_status AS ENUM (
  'pending',
  'delivered_normal',
  'delivered_missing_prescription',
  'delivered_no_money',
  'delivered_no_card_limit',
  'delivered_customer_absent',
  'delivered_customer_denied',
  'delivered_customer_gave_up',
  'delivered_wrong_product',
  'delivered_missing_product',
  'delivered_insufficient_address',
  'delivered_wrong_time',
  'delivered_other'
);

-- Create sale_status enum for sale workflow stages
CREATE TYPE sale_status AS ENUM (
  'draft',
  'pending_expedition',
  'dispatched',
  'delivered',
  'payment_pending',
  'payment_confirmed',
  'cancelled'
);

-- Main sales table
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL,
  
  -- Expedition
  expedition_validated_at timestamptz,
  expedition_validated_by uuid,
  assigned_delivery_user_id uuid,
  dispatched_at timestamptz,
  
  -- Delivery
  delivery_status delivery_status DEFAULT 'pending',
  delivery_notes text,
  delivered_at timestamptz,
  
  -- Financial values (in cents)
  subtotal_cents integer NOT NULL DEFAULT 0,
  discount_type text CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value integer DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  
  -- Payment confirmation
  payment_confirmed_at timestamptz,
  payment_confirmed_by uuid,
  payment_method text,
  payment_notes text,
  payment_proof_url text,
  invoice_pdf_url text,
  invoice_xml_url text,
  
  -- Status
  status sale_status NOT NULL DEFAULT 'draft',
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sale items (products in each sale)
CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES lead_products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  discount_cents integer NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sale status history for audit trail
CREATE TABLE public.sale_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  previous_status sale_status,
  new_status sale_status NOT NULL,
  changed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales table
CREATE POLICY "Users can view sales of their org"
ON public.sales FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert sales in their org"
ON public.sales FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update sales of their org"
ON public.sales FOR UPDATE
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete sales of their org"
ON public.sales FOR DELETE
USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

-- RLS Policies for sale_items
CREATE POLICY "Users can view sale items of their org"
ON public.sale_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM sales s 
  WHERE s.id = sale_items.sale_id 
  AND s.organization_id = get_user_organization_id()
));

CREATE POLICY "Users can insert sale items"
ON public.sale_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM sales s 
  WHERE s.id = sale_items.sale_id 
  AND s.organization_id = get_user_organization_id()
));

CREATE POLICY "Users can update sale items"
ON public.sale_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM sales s 
  WHERE s.id = sale_items.sale_id 
  AND s.organization_id = get_user_organization_id()
));

CREATE POLICY "Users can delete sale items"
ON public.sale_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM sales s 
  WHERE s.id = sale_items.sale_id 
  AND s.organization_id = get_user_organization_id()
));

-- RLS Policies for sale_status_history
CREATE POLICY "Users can view sale history of their org"
ON public.sale_status_history FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert sale history"
ON public.sale_status_history FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

-- Create indexes for performance
CREATE INDEX idx_sales_organization_id ON public.sales(organization_id);
CREATE INDEX idx_sales_lead_id ON public.sales(lead_id);
CREATE INDEX idx_sales_status ON public.sales(status);
CREATE INDEX idx_sales_assigned_delivery ON public.sales(assigned_delivery_user_id);
CREATE INDEX idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX idx_sale_status_history_sale_id ON public.sale_status_history(sale_id);

-- Trigger to update updated_at
CREATE TRIGGER update_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for sales documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('sales-documents', 'sales-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for sales documents
CREATE POLICY "Users can upload sales documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'sales-documents' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view sales documents of their org"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'sales-documents' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their sales documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'sales-documents' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Admins can delete sales documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'sales-documents' AND
  is_current_user_org_admin()
);