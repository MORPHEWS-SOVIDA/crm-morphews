-- =============================================
-- CHECKOUT ENGINE V2: Multi-Gateway + Fallback
-- =============================================

-- 1. Configuração global de gateways (Super Admin controla)
CREATE TABLE public.platform_gateway_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_type TEXT NOT NULL CHECK (gateway_type IN ('pagarme', 'appmax', 'stripe', 'asaas')),
  display_name TEXT NOT NULL,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  webhook_secret_encrypted TEXT,
  is_primary BOOLEAN DEFAULT false,
  priority INT DEFAULT 0, -- For fallback ordering (lower = higher priority)
  is_active BOOLEAN DEFAULT true,
  is_sandbox BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}', -- Gateway-specific config
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(gateway_type)
);

-- 2. Taxas por tenant (Super Admin configura por organização)
CREATE TABLE public.tenant_payment_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  -- PIX fees
  pix_fee_percentage DECIMAL(5,2) DEFAULT 1.5,
  pix_fee_fixed_cents INT DEFAULT 0,
  pix_release_days INT DEFAULT 2,
  pix_enabled BOOLEAN DEFAULT true,
  -- Card fees
  card_fee_percentage DECIMAL(5,2) DEFAULT 4.99,
  card_fee_fixed_cents INT DEFAULT 0,
  card_release_days INT DEFAULT 14,
  card_enabled BOOLEAN DEFAULT true,
  max_installments INT DEFAULT 12,
  -- Installment fees JSONB: {"2": 3.49, "3": 4.29, ...}
  installment_fees JSONB DEFAULT '{"2":3.49,"3":4.29,"4":4.99,"5":5.49,"6":5.99,"7":6.49,"8":6.99,"9":7.49,"10":7.99,"11":8.49,"12":8.99}',
  installment_fee_passed_to_buyer BOOLEAN DEFAULT true, -- If true, buyer pays installment fee
  -- Boleto fees
  boleto_fee_percentage DECIMAL(5,2) DEFAULT 0,
  boleto_fee_fixed_cents INT DEFAULT 350,
  boleto_release_days INT DEFAULT 2,
  boleto_enabled BOOLEAN DEFAULT true,
  boleto_expiration_days INT DEFAULT 3,
  -- General
  allow_save_card BOOLEAN DEFAULT true, -- Allow Card on File
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- 3. Tentativas de pagamento (logs para analytics e fallback tracking)
CREATE TABLE public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  sale_id UUID REFERENCES sales(id),
  cart_id UUID REFERENCES ecommerce_carts(id),
  gateway TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card', 'boleto')),
  amount_cents INT NOT NULL,
  installments INT DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'approved', 'refused', 'error', 'cancelled')),
  gateway_transaction_id TEXT,
  gateway_response JSONB,
  error_code TEXT,
  error_message TEXT,
  response_time_ms INT,
  is_fallback BOOLEAN DEFAULT false,
  fallback_from_gateway TEXT, -- Which gateway failed before this attempt
  attempt_number INT DEFAULT 1,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Métodos de pagamento salvos (Card on File para one-click)
CREATE TABLE public.saved_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  lead_id UUID REFERENCES leads(id) NOT NULL,
  gateway TEXT NOT NULL,
  gateway_customer_id TEXT, -- Customer ID in the gateway
  gateway_card_id TEXT, -- Card token/ID in the gateway
  payment_type TEXT NOT NULL CHECK (payment_type IN ('credit_card', 'debit_card')),
  card_brand TEXT, -- visa, mastercard, elo, etc
  card_last4 TEXT,
  card_expiry_month INT,
  card_expiry_year INT,
  card_holder_name TEXT,
  card_first6 TEXT, -- BIN for fraud detection
  is_default BOOLEAN DEFAULT false,
  fingerprint_hash TEXT, -- Card fingerprint for fraud detection
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  times_used INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- 5. Log de ações administrativas (Televendas + Anti-fraude)
CREATE TABLE public.payment_admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  sale_id UUID REFERENCES sales(id),
  payment_attempt_id UUID REFERENCES payment_attempts(id),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'reprocess', 'release_antifraud', 'manual_approve', 'manual_refuse',
    'capture_authorized', 'cancel_transaction', 'refund', 'one_click_charge'
  )),
  performed_by UUID,
  previous_status TEXT,
  new_status TEXT,
  gateway TEXT,
  amount_cents INT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Configuração de fallback por método de pagamento
CREATE TABLE public.gateway_fallback_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card', 'boleto')),
  primary_gateway TEXT NOT NULL,
  fallback_gateways TEXT[] DEFAULT '{}',
  fallback_enabled BOOLEAN DEFAULT true,
  max_fallback_attempts INT DEFAULT 2,
  fallback_on_error_codes TEXT[] DEFAULT '{}',
  no_fallback_error_codes TEXT[] DEFAULT '{"insufficient_funds", "invalid_card", "expired_card", "stolen_card"}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(payment_method)
);

-- Indexes for performance
CREATE INDEX idx_payment_attempts_sale ON payment_attempts(sale_id);
CREATE INDEX idx_payment_attempts_cart ON payment_attempts(cart_id);
CREATE INDEX idx_payment_attempts_org_created ON payment_attempts(organization_id, created_at DESC);
CREATE INDEX idx_payment_attempts_gateway_status ON payment_attempts(gateway, status);
CREATE INDEX idx_saved_methods_lead ON saved_payment_methods(lead_id, is_active);
CREATE INDEX idx_saved_methods_org ON saved_payment_methods(organization_id);
CREATE INDEX idx_tenant_fees_org ON tenant_payment_fees(organization_id);
CREATE INDEX idx_admin_actions_sale ON payment_admin_actions(sale_id);
CREATE INDEX idx_admin_actions_org_created ON payment_admin_actions(organization_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.platform_gateway_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_payment_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_fallback_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for platform_gateway_config (Super Admin only via service role)
CREATE POLICY "Platform gateway config is service role only"
ON public.platform_gateway_config FOR ALL USING (false);

-- RLS Policies for gateway_fallback_config (Super Admin only via service role)
CREATE POLICY "Gateway fallback config is service role only"
ON public.gateway_fallback_config FOR ALL USING (false);

-- RLS Policies for tenant_payment_fees
CREATE POLICY "Users can view their org payment fees"
ON public.tenant_payment_fees FOR SELECT
USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- RLS Policies for payment_attempts
CREATE POLICY "Users can view their org payment attempts"
ON public.payment_attempts FOR SELECT
USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- RLS Policies for saved_payment_methods
CREATE POLICY "Users can view their org saved payment methods"
ON public.saved_payment_methods FOR SELECT
USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- RLS Policies for payment_admin_actions
CREATE POLICY "Users can view their org admin actions"
ON public.payment_admin_actions FOR SELECT
USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create admin actions for their org"
ON public.payment_admin_actions FOR INSERT
WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Insert default fallback configurations
INSERT INTO public.gateway_fallback_config (payment_method, primary_gateway, fallback_gateways, fallback_enabled)
VALUES 
  ('pix', 'pagarme', ARRAY['appmax', 'stripe'], true),
  ('credit_card', 'pagarme', ARRAY['appmax', 'stripe'], true),
  ('boleto', 'pagarme', ARRAY['appmax'], true);

-- Add trigger for updated_at
CREATE TRIGGER update_platform_gateway_config_updated_at
BEFORE UPDATE ON platform_gateway_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_payment_fees_updated_at
BEFORE UPDATE ON tenant_payment_fees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gateway_fallback_config_updated_at
BEFORE UPDATE ON gateway_fallback_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();