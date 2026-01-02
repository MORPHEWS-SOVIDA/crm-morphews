-- Add new status 'returned' to sale_status enum
ALTER TYPE sale_status ADD VALUE IF NOT EXISTS 'returned';

-- Create table to store delivery return reasons (predefined + custom)
CREATE TABLE public.delivery_return_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_return_reasons ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view return reasons of their org" 
ON public.delivery_return_reasons 
FOR SELECT 
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage return reasons" 
ON public.delivery_return_reasons 
FOR ALL 
USING (
  organization_id = get_user_organization_id() 
  AND is_org_admin(auth.uid(), organization_id)
)
WITH CHECK (
  organization_id = get_user_organization_id() 
  AND is_org_admin(auth.uid(), organization_id)
);

-- Add columns to sales table for return tracking
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS return_reason_id UUID REFERENCES public.delivery_return_reasons(id),
ADD COLUMN IF NOT EXISTS return_notes TEXT,
ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS returned_by UUID;

-- Create function to seed default return reasons for new organizations
CREATE OR REPLACE FUNCTION public.seed_default_return_reasons()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.delivery_return_reasons (organization_id, name, is_system, position) VALUES
    (NEW.id, 'Sem receita', true, 1),
    (NEW.id, 'Sem notificação', true, 2),
    (NEW.id, 'Sem dinheiro', true, 3),
    (NEW.id, 'Endereço insuficiente', true, 4),
    (NEW.id, 'Fora do horário', true, 5),
    (NEW.id, 'Ausente', true, 6),
    (NEW.id, 'Recusou', true, 7);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to seed reasons on new organization
DROP TRIGGER IF EXISTS seed_return_reasons_on_org_create ON public.organizations;
CREATE TRIGGER seed_return_reasons_on_org_create
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.seed_default_return_reasons();

-- Seed default reasons for existing organizations
INSERT INTO public.delivery_return_reasons (organization_id, name, is_system, position)
SELECT o.id, reason.name, true, reason.position
FROM public.organizations o
CROSS JOIN (
  VALUES 
    ('Sem receita', 1),
    ('Sem notificação', 2),
    ('Sem dinheiro', 3),
    ('Endereço insuficiente', 4),
    ('Fora do horário', 5),
    ('Ausente', 6),
    ('Recusou', 7)
) AS reason(name, position)
WHERE NOT EXISTS (
  SELECT 1 FROM public.delivery_return_reasons drr 
  WHERE drr.organization_id = o.id
);