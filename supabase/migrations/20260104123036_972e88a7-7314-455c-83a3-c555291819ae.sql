-- Create table for sale changes log (audit trail)
CREATE TABLE public.sale_changes_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL, -- 'item_added', 'item_removed', 'item_quantity_changed', 'item_price_changed', 'discount_changed', 'delivery_changed', 'payment_changed', 'status_changed'
  field_name TEXT, -- e.g. 'quantity', 'unit_price_cents', 'discount_cents'
  old_value TEXT,
  new_value TEXT,
  item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL, -- Optional: link to specific item
  product_name TEXT, -- For reference when item is deleted
  notes TEXT, -- Optional notes about the change
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sale_changes_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view logs for their organization
CREATE POLICY "Users can view sale changes logs for their organization"
ON public.sale_changes_log
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- Policy: Users can insert logs for their organization
CREATE POLICY "Users can insert sale changes logs for their organization"
ON public.sale_changes_log
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_sale_changes_log_sale_id ON public.sale_changes_log(sale_id);
CREATE INDEX idx_sale_changes_log_organization_id ON public.sale_changes_log(organization_id);
CREATE INDEX idx_sale_changes_log_changed_at ON public.sale_changes_log(changed_at DESC);

-- Add flag to sales table to track if sale was edited
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS was_edited BOOLEAN DEFAULT false;