-- Create organization_funnel_stages table for custom stages per organization
CREATE TABLE public.organization_funnel_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-gray-200',
  text_color TEXT NOT NULL DEFAULT 'text-gray-800',
  stage_type TEXT NOT NULL DEFAULT 'funnel', -- 'funnel', 'cloud', 'trash'
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, position)
);

-- Enable RLS
ALTER TABLE public.organization_funnel_stages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view stages of their org"
ON public.organization_funnel_stages
FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Org admins can insert stages"
ON public.organization_funnel_stages
FOR INSERT
WITH CHECK (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins can update stages"
ON public.organization_funnel_stages
FOR UPDATE
USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete stages"
ON public.organization_funnel_stages
FOR DELETE
USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid(), organization_id));

-- Create trigger for updated_at
CREATE TRIGGER update_organization_funnel_stages_updated_at
BEFORE UPDATE ON public.organization_funnel_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to initialize default stages for new organization
CREATE OR REPLACE FUNCTION public.initialize_org_funnel_stages(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO organization_funnel_stages (organization_id, name, position, color, text_color, stage_type, is_default)
  VALUES
    (org_id, 'Não classificado', 0, 'bg-slate-200', 'text-slate-700', 'cloud', true),
    (org_id, 'Prospectando / Aguardando resposta', 1, 'bg-orange-200', 'text-orange-900', 'funnel', true),
    (org_id, 'Cliente nos chamou', 2, 'bg-orange-400', 'text-white', 'funnel', true),
    (org_id, 'Convencendo a marcar call', 3, 'bg-yellow-300', 'text-yellow-900', 'funnel', true),
    (org_id, 'Call agendada', 4, 'bg-sky-300', 'text-sky-900', 'funnel', true),
    (org_id, 'Call feita positiva', 5, 'bg-green-300', 'text-green-900', 'funnel', true),
    (org_id, 'Aguardando pagamento', 6, 'bg-green-500', 'text-white', 'funnel', true),
    (org_id, 'PAGO - SUCESSO!', 7, 'bg-amber-400', 'text-amber-900', 'funnel', true),
    (org_id, 'Sem interesse', 8, 'bg-red-200', 'text-red-800', 'trash', true);
END;
$$;

-- Initialize stages for existing organizations that don't have any
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    IF NOT EXISTS (SELECT 1 FROM organization_funnel_stages WHERE organization_id = org.id) THEN
      PERFORM initialize_org_funnel_stages(org.id);
    END IF;
  END LOOP;
END;
$$;