-- SMS Credits System (separate from energy/voice)

-- SMS packages available for purchase
CREATE TABLE public.sms_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sms_count integer NOT NULL,
  price_cents integer NOT NULL,
  price_per_sms_cents numeric(10,2) NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Pre-populate with pricing tiers
INSERT INTO public.sms_packages (name, sms_count, price_cents, price_per_sms_cents) VALUES
  ('500 SMS', 500, 7500, 15.00),
  ('2.000 SMS', 2000, 24000, 12.00),
  ('5.000 SMS', 5000, 50000, 10.00),
  ('10.000 SMS', 10000, 90000, 9.00);

-- SMS balance per organization
CREATE TABLE public.sms_credits_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  current_credits integer NOT NULL DEFAULT 0,
  total_purchased integer NOT NULL DEFAULT 0,
  total_used integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(organization_id)
);

-- SMS credits purchases history
CREATE TABLE public.sms_credits_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.sms_packages(id),
  credits_amount integer NOT NULL,
  price_cents integer NOT NULL,
  payment_method text,
  payment_reference text,
  purchased_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- SMS usage log
CREATE TABLE public.sms_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id),
  phone text NOT NULL,
  message text NOT NULL,
  facilita_sms_id text,
  external_key text,
  status text DEFAULT 'pending',
  status_code integer,
  credits_used integer DEFAULT 1,
  sent_by uuid REFERENCES auth.users(id),
  sent_at timestamp with time zone DEFAULT now(),
  delivered_at timestamp with time zone,
  error_message text
);

-- FacilitaMovel configuration per organization
CREATE TABLE public.sms_provider_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'facilitamovel',
  api_user text,
  api_password text,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(organization_id, provider)
);

-- Function to deduct SMS credits
CREATE OR REPLACE FUNCTION public.deduct_sms_credits(
  p_organization_id uuid,
  p_credits_to_deduct integer
) RETURNS boolean AS $$
DECLARE
  v_current_balance integer;
BEGIN
  SELECT current_credits INTO v_current_balance
  FROM public.sms_credits_balance
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF v_current_balance IS NULL OR v_current_balance < p_credits_to_deduct THEN
    RETURN false;
  END IF;

  UPDATE public.sms_credits_balance
  SET 
    current_credits = current_credits - p_credits_to_deduct,
    total_used = total_used + p_credits_to_deduct,
    updated_at = now()
  WHERE organization_id = p_organization_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to add SMS credits
CREATE OR REPLACE FUNCTION public.add_sms_credits(
  p_organization_id uuid,
  p_credits_to_add integer
) RETURNS boolean AS $$
BEGIN
  INSERT INTO public.sms_credits_balance (organization_id, current_credits, total_purchased)
  VALUES (p_organization_id, p_credits_to_add, p_credits_to_add)
  ON CONFLICT (organization_id) DO UPDATE SET
    current_credits = sms_credits_balance.current_credits + p_credits_to_add,
    total_purchased = sms_credits_balance.total_purchased + p_credits_to_add,
    updated_at = now();

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable RLS
ALTER TABLE public.sms_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_credits_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_credits_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_provider_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for packages (public read)
CREATE POLICY "Anyone can view SMS packages" ON public.sms_packages FOR SELECT USING (true);

-- RLS Policies for balance
CREATE POLICY "Org members can view their SMS balance" ON public.sms_credits_balance 
  FOR SELECT USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    )
  );

-- RLS Policies for purchases
CREATE POLICY "Org members can view their SMS purchases" ON public.sms_credits_purchases 
  FOR SELECT USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can create SMS purchases" ON public.sms_credits_purchases 
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om 
      WHERE om.user_id = auth.uid() AND om.role = 'admin'
    )
  );

-- RLS Policies for usage
CREATE POLICY "Org members can view their SMS usage" ON public.sms_usage 
  FOR SELECT USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can create SMS usage" ON public.sms_usage 
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()
    )
  );

-- RLS Policies for provider config
CREATE POLICY "Org admins can manage SMS provider config" ON public.sms_provider_config 
  FOR ALL USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om 
      WHERE om.user_id = auth.uid() AND om.role = 'admin'
    )
  );