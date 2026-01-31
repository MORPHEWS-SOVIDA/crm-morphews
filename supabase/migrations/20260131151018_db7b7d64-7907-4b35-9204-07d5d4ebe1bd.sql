-- Table to store 3C+ validation configurations (blacklist, CNPJ numbers)
CREATE TABLE public.voip_3c_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  blacklist_numbers TEXT[] NOT NULL DEFAULT '{}',
  cnpj_numbers TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Table to store 3C+ validation reports
CREATE TABLE public.voip_3c_validations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  total_calls INTEGER NOT NULL DEFAULT 0,
  calls_without_record INTEGER NOT NULL DEFAULT 0,
  calls_with_record_no_sale INTEGER NOT NULL DEFAULT 0,
  validation_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voip_3c_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voip_3c_validations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for voip_3c_config
CREATE POLICY "Users can view org config" ON public.voip_3c_config
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage org config" ON public.voip_3c_config
  FOR ALL USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om 
      WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')
    )
  );

-- RLS Policies for voip_3c_validations
CREATE POLICY "Users can view org validations" ON public.voip_3c_validations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage validations" ON public.voip_3c_validations
  FOR ALL USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om 
      WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager')
    )
  );