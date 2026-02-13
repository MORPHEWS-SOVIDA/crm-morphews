
-- Product audit/changes log table
CREATE TABLE public.product_changes_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted', 'cloned', 'price_changed', 'commission_changed', 'stock_changed', 'kit_changed', 'general_edit')),
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_product_changes_log_product ON public.product_changes_log(product_id);
CREATE INDEX idx_product_changes_log_org ON public.product_changes_log(organization_id);
CREATE INDEX idx_product_changes_log_changed_at ON public.product_changes_log(changed_at DESC);

-- Enable RLS
ALTER TABLE public.product_changes_log ENABLE ROW LEVEL SECURITY;

-- RLS: users can see logs from their organization
CREATE POLICY "Users can view product logs from their org"
ON public.product_changes_log
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- RLS: users can insert logs for their org
CREATE POLICY "Users can insert product logs for their org"
ON public.product_changes_log
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
  AND changed_by = auth.uid()
);

-- Add created_by column to lead_products if not exists
ALTER TABLE public.lead_products ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.lead_products ADD COLUMN IF NOT EXISTS updated_by UUID;
