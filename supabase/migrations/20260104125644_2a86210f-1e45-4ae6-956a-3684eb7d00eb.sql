-- Create enum for carrier tracking status
CREATE TYPE carrier_tracking_status AS ENUM (
  'waiting_post',
  'posted',
  'in_destination_city',
  'attempt_1_failed',
  'attempt_2_failed',
  'attempt_3_failed',
  'waiting_pickup',
  'returning_to_sender',
  'delivered'
);

-- Create table for sale checkpoints (independent tasks/stages)
CREATE TABLE public.sale_checkpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  checkpoint_type TEXT NOT NULL, -- 'dispatched', 'delivered', 'payment_confirmed'
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sale_id, checkpoint_type)
);

-- Create table for carrier tracking history
CREATE TABLE public.sale_carrier_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  status carrier_tracking_status NOT NULL,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add current carrier tracking status to sales
ALTER TABLE public.sales 
ADD COLUMN carrier_tracking_status carrier_tracking_status;

-- Enable RLS
ALTER TABLE public.sale_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_carrier_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sale_checkpoints
CREATE POLICY "Users can view sale checkpoints from their org"
ON public.sale_checkpoints FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert sale checkpoints to their org"
ON public.sale_checkpoints FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update sale checkpoints from their org"
ON public.sale_checkpoints FOR UPDATE
USING (organization_id = public.get_user_organization_id());

-- RLS Policies for sale_carrier_tracking
CREATE POLICY "Users can view carrier tracking from their org"
ON public.sale_carrier_tracking FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert carrier tracking to their org"
ON public.sale_carrier_tracking FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

-- Create trigger for updated_at
CREATE TRIGGER update_sale_checkpoints_updated_at
BEFORE UPDATE ON public.sale_checkpoints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_sale_checkpoints_sale_id ON public.sale_checkpoints(sale_id);
CREATE INDEX idx_sale_carrier_tracking_sale_id ON public.sale_carrier_tracking(sale_id);