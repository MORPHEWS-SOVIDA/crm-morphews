-- Create sale checkpoint history table for tracking changes
CREATE TABLE public.sale_checkpoint_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkpoint_id UUID REFERENCES public.sale_checkpoints(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  checkpoint_type TEXT NOT NULL,
  action TEXT NOT NULL, -- 'completed' or 'uncompleted'
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sale_checkpoint_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view checkpoint history in their organization"
ON public.sale_checkpoint_history
FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert checkpoint history in their organization"
ON public.sale_checkpoint_history
FOR INSERT
WITH CHECK (organization_id IN (
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
));

-- Create index for faster queries
CREATE INDEX idx_sale_checkpoint_history_sale_id ON public.sale_checkpoint_history(sale_id);
CREATE INDEX idx_sale_checkpoint_history_checkpoint_type ON public.sale_checkpoint_history(sale_id, checkpoint_type);