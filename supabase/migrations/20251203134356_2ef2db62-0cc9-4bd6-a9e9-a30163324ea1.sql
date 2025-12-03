-- Create table for interested leads (abandoned cart)
CREATE TABLE public.interested_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  plan_id UUID REFERENCES public.subscription_plans(id),
  plan_name TEXT,
  status TEXT NOT NULL DEFAULT 'interested', -- interested, checkout_started, converted
  converted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.interested_leads ENABLE ROW LEVEL SECURITY;

-- Only admins can view interested leads
CREATE POLICY "Admins can view all interested leads"
ON public.interested_leads
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can insert (public form)
CREATE POLICY "Anyone can insert interested leads"
ON public.interested_leads
FOR INSERT
WITH CHECK (true);

-- Admins can update
CREATE POLICY "Admins can update interested leads"
ON public.interested_leads
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_interested_leads_updated_at
BEFORE UPDATE ON public.interested_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();