-- Voice Minutes Packages (pacotes de minutos disponíveis)
CREATE TABLE IF NOT EXISTS public.voice_minutes_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  minutes INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  price_per_minute_cents INTEGER GENERATED ALWAYS AS (price_cents / NULLIF(minutes, 0)) STORED,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Voice Minutes Balance (banco de minutos separado de energia)
CREATE TABLE IF NOT EXISTS public.voice_minutes_balance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  minutes_remaining INTEGER NOT NULL DEFAULT 0,
  minutes_purchased INTEGER NOT NULL DEFAULT 0,
  minutes_used INTEGER NOT NULL DEFAULT 0,
  last_purchase_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Voice Minutes Purchases (histórico de compras)
CREATE TABLE IF NOT EXISTS public.voice_minutes_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.voice_minutes_packages(id),
  minutes_purchased INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  purchased_by UUID,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Voice Minutes Usage Log (consumo minuto a minuto)
CREATE TABLE IF NOT EXISTS public.voice_minutes_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_log_id UUID REFERENCES public.voice_call_logs(id),
  minutes_used INTEGER NOT NULL DEFAULT 1,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default packages
INSERT INTO public.voice_minutes_packages (name, description, minutes, price_cents, display_order) VALUES
  ('1 Hora', 'Pacote básico de 60 minutos', 60, 12000, 1),
  ('3 Horas', 'Pacote intermediário com 20% de desconto', 180, 28800, 2),
  ('6 Horas', 'Pacote avançado com 25% de desconto', 360, 54000, 3)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.voice_minutes_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_minutes_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_minutes_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_minutes_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for voice_minutes_balance
CREATE POLICY "Users can view their org minutes balance"
  ON public.voice_minutes_balance FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- RLS Policies for voice_minutes_packages (public read)
CREATE POLICY "Anyone can view active packages"
  ON public.voice_minutes_packages FOR SELECT
  USING (is_active = true);

CREATE POLICY "Master admins can manage packages"
  ON public.voice_minutes_packages FOR ALL
  USING (public.is_master_admin(auth.uid()));

-- RLS Policies for voice_minutes_purchases
CREATE POLICY "Users can view their org purchases"
  ON public.voice_minutes_purchases FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create purchases for their org"
  ON public.voice_minutes_purchases FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- RLS Policies for voice_minutes_usage
CREATE POLICY "Users can view their org usage"
  ON public.voice_minutes_usage FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Function to deduct minutes after call
CREATE OR REPLACE FUNCTION public.deduct_voice_minutes(
  p_organization_id UUID,
  p_call_log_id UUID,
  p_minutes INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  SELECT minutes_remaining INTO v_current_balance
  FROM voice_minutes_balance
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF v_current_balance IS NULL OR v_current_balance < p_minutes THEN
    RETURN FALSE;
  END IF;

  v_new_balance := v_current_balance - p_minutes;

  UPDATE voice_minutes_balance
  SET 
    minutes_remaining = v_new_balance,
    minutes_used = minutes_used + p_minutes,
    updated_at = now()
  WHERE organization_id = p_organization_id;

  INSERT INTO voice_minutes_usage (
    organization_id,
    call_log_id,
    minutes_used,
    balance_before,
    balance_after
  ) VALUES (
    p_organization_id,
    p_call_log_id,
    p_minutes,
    v_current_balance,
    v_new_balance
  );

  RETURN TRUE;
END;
$$;

-- Function to add minutes after purchase
CREATE OR REPLACE FUNCTION public.add_voice_minutes(
  p_organization_id UUID,
  p_minutes INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  INSERT INTO voice_minutes_balance (organization_id, minutes_remaining, minutes_purchased, last_purchase_at)
  VALUES (p_organization_id, p_minutes, p_minutes, now())
  ON CONFLICT (organization_id) DO UPDATE SET
    minutes_remaining = voice_minutes_balance.minutes_remaining + p_minutes,
    minutes_purchased = voice_minutes_balance.minutes_purchased + p_minutes,
    last_purchase_at = now(),
    updated_at = now()
  RETURNING minutes_remaining INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;