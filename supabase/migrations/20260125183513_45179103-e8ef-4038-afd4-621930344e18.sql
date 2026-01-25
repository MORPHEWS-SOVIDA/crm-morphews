-- ============================================
-- Melhor Envio Integration Tables
-- Replacing Correios integration
-- ============================================

-- 1. Melhor Envio Config per Organization
CREATE TABLE public.melhor_envio_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  ambiente text NOT NULL DEFAULT 'production' CHECK (ambiente IN ('sandbox', 'production')),
  token_encrypted text, -- If org has their own token, otherwise use system token
  
  -- Sender info
  sender_name text,
  sender_cpf_cnpj text,
  sender_cnpj text,
  sender_ie text,
  sender_street text,
  sender_number text,
  sender_complement text,
  sender_neighborhood text,
  sender_city text,
  sender_state text,
  sender_cep text,
  sender_phone text,
  sender_email text,
  
  -- Default package dimensions
  default_weight_grams integer DEFAULT 500,
  default_height_cm integer DEFAULT 10,
  default_width_cm integer DEFAULT 15,
  default_length_cm integer DEFAULT 20,
  default_agency_id integer, -- For services that require agency selection
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for config
ALTER TABLE public.melhor_envio_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org config" ON public.melhor_envio_config
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their org config" ON public.melhor_envio_config
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their org config" ON public.melhor_envio_config
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- 2. Enabled Services per Organization
CREATE TABLE public.melhor_envio_enabled_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id integer NOT NULL,
  service_name text NOT NULL,
  company_name text,
  is_enabled boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  picking_cost_cents integer NOT NULL DEFAULT 0,
  extra_handling_days integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, service_id)
);

ALTER TABLE public.melhor_envio_enabled_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org services" ON public.melhor_envio_enabled_services
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their org services" ON public.melhor_envio_enabled_services
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- 3. Generated Labels
CREATE TABLE public.melhor_envio_labels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  melhor_envio_order_id text NOT NULL,
  tracking_code text NOT NULL,
  service_id integer NOT NULL,
  service_name text,
  company_name text,
  
  -- Recipient
  recipient_name text NOT NULL,
  recipient_cpf_cnpj text,
  recipient_street text,
  recipient_number text,
  recipient_complement text,
  recipient_neighborhood text,
  recipient_city text,
  recipient_state text,
  recipient_cep text NOT NULL,
  recipient_phone text,
  
  -- Package
  weight_grams integer,
  height_cm integer,
  width_cm integer,
  length_cm integer,
  declared_value_cents integer,
  
  -- Label
  label_pdf_url text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  api_response jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz,
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.melhor_envio_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org labels" ON public.melhor_envio_labels
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create labels" ON public.melhor_envio_labels
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update labels" ON public.melhor_envio_labels
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- 4. Add melhor_envio_service_id to shipping_carriers
ALTER TABLE public.shipping_carriers 
ADD COLUMN IF NOT EXISTS melhor_envio_service_id integer DEFAULT NULL;

COMMENT ON COLUMN public.shipping_carriers.melhor_envio_service_id IS 'Melhor Envio service ID to auto-select when generating labels';

-- 5. Triggers for updated_at
CREATE TRIGGER set_melhor_envio_config_updated_at
  BEFORE UPDATE ON public.melhor_envio_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_melhor_envio_services_updated_at
  BEFORE UPDATE ON public.melhor_envio_enabled_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_melhor_envio_labels_updated_at
  BEFORE UPDATE ON public.melhor_envio_labels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Create initial config for Sovida organization (thiago@sonatura.com.br)
INSERT INTO public.melhor_envio_config (organization_id, is_active, ambiente)
SELECT o.id, true, 'production'
FROM public.organizations o
JOIN public.profiles p ON p.organization_id = o.id
WHERE p.email = 'thiago@sonatura.com.br'
ON CONFLICT (organization_id) DO UPDATE SET is_active = true, ambiente = 'production';