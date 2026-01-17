-- Tabela principal de integrações
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'webhook_inbound' CHECK (type IN ('webhook_inbound', 'webhook_outbound', 'api', 'native')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
  auth_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  
  -- Configurações padrão para leads criados via webhook
  default_stage TEXT DEFAULT 'cloud',
  default_responsible_user_ids UUID[] DEFAULT '{}',
  default_product_id UUID REFERENCES public.lead_products(id) ON DELETE SET NULL,
  auto_followup_days INTEGER,
  non_purchase_reason_id UUID REFERENCES public.non_purchase_reasons(id) ON DELETE SET NULL,
  
  -- Configurações extras (JSON flexível)
  settings JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Mapeamento de campos (source → target)
CREATE TABLE public.integration_field_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL CHECK (target_field IN ('name', 'email', 'whatsapp', 'cpf', 'instagram', 'specialty', 'observations', 'address_street', 'address_number', 'address_complement', 'address_neighborhood', 'address_city', 'address_state', 'address_cep')),
  transform_type TEXT DEFAULT 'direct' CHECK (transform_type IN ('direct', 'phone_normalize', 'uppercase', 'lowercase', 'trim')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Eventos de webhook outbound
CREATE TABLE public.integration_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('lead_created', 'lead_updated', 'lead_assigned', 'lead_transferred', 'lead_stage_changed', 'demand_created', 'demand_updated', 'demand_completed', 'sla_breached', 'sale_created', 'sale_paid', 'sale_delivered')),
  url TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  headers JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Logs de todas as integrações
CREATE TABLE public.integration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  event_type TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'pending')),
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  processing_time_ms INTEGER,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_integrations_organization ON public.integrations(organization_id);
CREATE INDEX idx_integrations_token ON public.integrations(auth_token);
CREATE INDEX idx_integration_logs_integration ON public.integration_logs(integration_id);
CREATE INDEX idx_integration_logs_created ON public.integration_logs(created_at DESC);
CREATE INDEX idx_integration_field_mappings_integration ON public.integration_field_mappings(integration_id);
CREATE INDEX idx_integration_events_integration ON public.integration_events(integration_id);

-- RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

-- Policies para integrations
CREATE POLICY "Users can view integrations from their organization"
ON public.integrations FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Admins can manage integrations"
ON public.integrations FOR ALL
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members 
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
));

-- Policies para field mappings
CREATE POLICY "Users can view field mappings from their organization"
ON public.integration_field_mappings FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Admins can manage field mappings"
ON public.integration_field_mappings FOR ALL
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members 
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
));

-- Policies para events
CREATE POLICY "Users can view events from their organization"
ON public.integration_events FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Admins can manage events"
ON public.integration_events FOR ALL
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members 
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
));

-- Policies para logs
CREATE POLICY "Users can view logs from their organization"
ON public.integration_logs FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "System can insert logs"
ON public.integration_logs FOR INSERT
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_integrations_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_integration_events_updated_at
BEFORE UPDATE ON public.integration_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();