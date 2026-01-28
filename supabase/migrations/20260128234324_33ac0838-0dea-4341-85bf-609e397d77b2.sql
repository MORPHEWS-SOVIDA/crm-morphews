-- =============================================
-- SISTEMA DE IMPLEMENTADORES MORPHEWS
-- =============================================

-- Tabela principal de implementadores
CREATE TABLE public.implementers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  total_clients INTEGER DEFAULT 0,
  total_earnings_cents BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Vendas/clientes trazidos por implementadores
CREATE TABLE public.implementer_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  implementer_id UUID NOT NULL REFERENCES public.implementers(id) ON DELETE CASCADE,
  client_organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_subscription_id UUID REFERENCES public.subscriptions(id),
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  implementation_fee_cents INTEGER DEFAULT 0,
  first_payment_cents INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'churned')),
  created_at TIMESTAMPTZ DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  UNIQUE(client_organization_id)
);

-- Comissões dos implementadores
CREATE TABLE public.implementer_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  implementer_id UUID NOT NULL REFERENCES public.implementers(id) ON DELETE CASCADE,
  implementer_sale_id UUID NOT NULL REFERENCES public.implementer_sales(id) ON DELETE CASCADE,
  commission_type VARCHAR(30) NOT NULL CHECK (commission_type IN ('implementation_fee', 'first_month', 'recurring')),
  gross_amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  net_amount_cents INTEGER NOT NULL,
  period_month INTEGER,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- Links de checkout customizados pelos implementadores
CREATE TABLE public.implementer_checkout_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  implementer_id UUID NOT NULL REFERENCES public.implementers(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  implementation_fee_cents INTEGER DEFAULT 0,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  uses_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_implementers_user_id ON public.implementers(user_id);
CREATE INDEX idx_implementers_referral_code ON public.implementers(referral_code);
CREATE INDEX idx_implementer_sales_implementer ON public.implementer_sales(implementer_id);
CREATE INDEX idx_implementer_sales_status ON public.implementer_sales(status);
CREATE INDEX idx_implementer_commissions_implementer ON public.implementer_commissions(implementer_id);
CREATE INDEX idx_implementer_commissions_status ON public.implementer_commissions(status);
CREATE INDEX idx_implementer_checkout_links_slug ON public.implementer_checkout_links(slug);

-- Enable RLS
ALTER TABLE public.implementers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implementer_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implementer_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implementer_checkout_links ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is an implementer
CREATE OR REPLACE FUNCTION public.is_implementer(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.implementers
    WHERE user_id = p_user_id AND is_active = true
  )
$$;

-- Helper function to get implementer's subscription status
CREATE OR REPLACE FUNCTION public.implementer_has_active_subscription(p_implementer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.implementers i
    JOIN public.subscriptions s ON s.organization_id = i.organization_id
    WHERE i.id = p_implementer_id 
    AND s.status = 'active'
  )
$$;

-- RLS Policies for implementers
CREATE POLICY "Users can view their own implementer record"
ON public.implementers FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all implementers"
ON public.implementers FOR ALL
TO authenticated
USING (public.has_admin_role(auth.uid()));

-- RLS Policies for implementer_sales
CREATE POLICY "Implementers can view their own sales"
ON public.implementer_sales FOR SELECT
TO authenticated
USING (
  implementer_id IN (SELECT id FROM public.implementers WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can manage all implementer sales"
ON public.implementer_sales FOR ALL
TO authenticated
USING (public.has_admin_role(auth.uid()));

-- RLS Policies for implementer_commissions
CREATE POLICY "Implementers can view their own commissions"
ON public.implementer_commissions FOR SELECT
TO authenticated
USING (
  implementer_id IN (SELECT id FROM public.implementers WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can manage all commissions"
ON public.implementer_commissions FOR ALL
TO authenticated
USING (public.has_admin_role(auth.uid()));

-- RLS Policies for implementer_checkout_links
CREATE POLICY "Implementers can manage their own links"
ON public.implementer_checkout_links FOR ALL
TO authenticated
USING (
  implementer_id IN (SELECT id FROM public.implementers WHERE user_id = auth.uid())
);

CREATE POLICY "Public can view active links"
ON public.implementer_checkout_links FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY "Admins can manage all links"
ON public.implementer_checkout_links FOR ALL
TO authenticated
USING (public.has_admin_role(auth.uid()));

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_implementer_code()
RETURNS VARCHAR(20)
LANGUAGE plpgsql
AS $$
DECLARE
  new_code VARCHAR(20);
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'IMP-' || upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.implementers WHERE referral_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;

-- Trigger to auto-generate referral code
CREATE OR REPLACE FUNCTION public.set_implementer_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := public.generate_implementer_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_implementer_code
BEFORE INSERT ON public.implementers
FOR EACH ROW
EXECUTE FUNCTION public.set_implementer_referral_code();

-- Function to process implementer commission on subscription payment
CREATE OR REPLACE FUNCTION public.process_implementer_commission(
  p_subscription_id UUID,
  p_payment_amount_cents INTEGER,
  p_is_first_payment BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_implementer_sale RECORD;
  v_commission_rate DECIMAL;
  v_gross_amount INTEGER;
  v_platform_fee INTEGER;
  v_net_amount INTEGER;
  v_commission_type VARCHAR(30);
  v_period_month INTEGER;
BEGIN
  -- Find if this subscription has an implementer
  SELECT * INTO v_implementer_sale
  FROM public.implementer_sales
  WHERE client_subscription_id = p_subscription_id
  AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Check if implementer has active subscription (required to receive commissions)
  IF NOT public.implementer_has_active_subscription(v_implementer_sale.implementer_id) THEN
    RETURN;
  END IF;
  
  -- Determine commission rate and type
  IF p_is_first_payment THEN
    v_commission_rate := 0.40; -- 40% first month
    v_commission_type := 'first_month';
    v_period_month := 1;
  ELSE
    v_commission_rate := 0.10; -- 10% recurring
    v_commission_type := 'recurring';
    -- Calculate period month
    SELECT COALESCE(MAX(period_month), 0) + 1 INTO v_period_month
    FROM public.implementer_commissions
    WHERE implementer_sale_id = v_implementer_sale.id
    AND commission_type IN ('first_month', 'recurring');
  END IF;
  
  -- Calculate amounts
  v_gross_amount := FLOOR(p_payment_amount_cents * v_commission_rate);
  v_platform_fee := 0; -- No platform fee on subscription commissions
  v_net_amount := v_gross_amount;
  
  -- Insert commission record
  INSERT INTO public.implementer_commissions (
    implementer_id,
    implementer_sale_id,
    commission_type,
    gross_amount_cents,
    platform_fee_cents,
    net_amount_cents,
    period_month,
    status
  ) VALUES (
    v_implementer_sale.implementer_id,
    v_implementer_sale.id,
    v_commission_type,
    v_gross_amount,
    v_platform_fee,
    v_net_amount,
    v_period_month,
    'pending'
  );
  
  -- Update implementer totals
  UPDATE public.implementers
  SET 
    total_earnings_cents = total_earnings_cents + v_net_amount,
    updated_at = now()
  WHERE id = v_implementer_sale.implementer_id;
END;
$$;