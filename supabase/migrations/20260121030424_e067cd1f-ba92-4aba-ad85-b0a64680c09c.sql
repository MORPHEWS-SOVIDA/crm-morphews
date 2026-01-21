-- =============================================================================
-- CAMPOS PERSONALIZADOS POR TENANT
-- =============================================================================

-- Tabela de definições de campos personalizados (máximo 10 por org)
CREATE TABLE IF NOT EXISTS public.lead_custom_field_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  is_required BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_field_name_per_org UNIQUE (organization_id, field_name)
);

-- Tabela de valores dos campos personalizados
CREATE TABLE IF NOT EXISTS public.lead_custom_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  field_definition_id UUID NOT NULL REFERENCES public.lead_custom_field_definitions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_value_per_lead_field UNIQUE (lead_id, field_definition_id)
);

-- =============================================================================
-- HISTÓRICO DE WEBHOOKS POR LEAD
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lead_webhook_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.integrations(id) ON DELETE SET NULL,
  integration_name TEXT,
  payload JSONB NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_successfully BOOLEAN DEFAULT true,
  error_message TEXT
);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.lead_custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_webhook_history ENABLE ROW LEVEL SECURITY;

-- Policies para lead_custom_field_definitions
CREATE POLICY "Users can view custom field definitions for their org"
ON public.lead_custom_field_definitions FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Admins can manage custom field definitions"
ON public.lead_custom_field_definitions FOR ALL
USING (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
  )
);

-- Policies para lead_custom_field_values
CREATE POLICY "Users can view custom field values for their org"
ON public.lead_custom_field_values FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can manage custom field values for their org"
ON public.lead_custom_field_values FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Policies para lead_webhook_history
CREATE POLICY "Users can view webhook history for their org"
ON public.lead_webhook_history FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "System can insert webhook history"
ON public.lead_webhook_history FOR INSERT
WITH CHECK (true);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_custom_field_defs_org ON public.lead_custom_field_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_lead ON public.lead_custom_field_values(lead_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_def ON public.lead_custom_field_values(field_definition_id);
CREATE INDEX IF NOT EXISTS idx_webhook_history_lead ON public.lead_webhook_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_webhook_history_org ON public.lead_webhook_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_history_received ON public.lead_webhook_history(received_at DESC);

-- =============================================================================
-- FUNCTION TO LIMIT CUSTOM FIELDS TO 10 PER ORG
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_max_custom_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.lead_custom_field_definitions 
    WHERE organization_id = NEW.organization_id AND is_active = true
  ) >= 10 THEN
    RAISE EXCEPTION 'Maximum of 10 custom fields per organization reached';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS enforce_max_custom_fields ON public.lead_custom_field_definitions;
CREATE TRIGGER enforce_max_custom_fields
BEFORE INSERT ON public.lead_custom_field_definitions
FOR EACH ROW
EXECUTE FUNCTION public.check_max_custom_fields();