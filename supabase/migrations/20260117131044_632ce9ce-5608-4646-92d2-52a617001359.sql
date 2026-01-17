-- Create table to store product conference history
CREATE TABLE public.sale_item_conferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conferenced_by UUID NOT NULL,
  conferenced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  quantity_checked INTEGER NOT NULL DEFAULT 1,
  stage TEXT NOT NULL DEFAULT 'separation', -- separation, dispatch, return
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_sale_item_conferences_sale_id ON public.sale_item_conferences(sale_id);
CREATE INDEX idx_sale_item_conferences_sale_item_id ON public.sale_item_conferences(sale_item_id);

-- Enable RLS
ALTER TABLE public.sale_item_conferences ENABLE ROW LEVEL SECURITY;

-- RLS policies using organization_members (correct table)
CREATE POLICY "Users can view conferences in their organization"
ON public.sale_item_conferences
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create conferences in their organization"
ON public.sale_item_conferences
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own conferences"
ON public.sale_item_conferences
FOR DELETE
USING (
  conferenced_by = auth.uid() AND
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- Add columns to sales to track overall conference status
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS conference_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS conference_completed_by UUID;

-- Add realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_item_conferences;