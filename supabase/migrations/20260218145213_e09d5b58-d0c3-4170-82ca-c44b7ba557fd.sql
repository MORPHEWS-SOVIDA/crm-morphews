
-- Table to store multiple payment methods per sale (split payments)
CREATE TABLE public.sale_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES public.payment_methods(id),
  payment_method_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  notes TEXT,
  -- Conciliation data for card-based methods
  transaction_date TIMESTAMPTZ,
  card_brand TEXT,
  transaction_type TEXT,
  nsu_cv TEXT,
  acquirer_id UUID REFERENCES public.payment_acquirers(id),
  installments INTEGER DEFAULT 1,
  -- Who registered / last modified
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_sale_payments_sale_id ON public.sale_payments(sale_id);
CREATE INDEX idx_sale_payments_org ON public.sale_payments(organization_id);

-- Enable RLS
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies: org members can manage
CREATE POLICY "Users can view sale payments in their org"
ON public.sale_payments FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert sale payments in their org"
ON public.sale_payments FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update sale payments in their org"
ON public.sale_payments FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete sale payments in their org"
ON public.sale_payments FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_sale_payments_updated_at
BEFORE UPDATE ON public.sale_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
