-- Create carrier_tracking_statuses table (similar to motoboy_tracking_statuses)
CREATE TABLE IF NOT EXISTS public.carrier_tracking_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status_key TEXT NOT NULL,
  label TEXT NOT NULL,
  webhook_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- New message fields
  whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  message_template TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'audio', 'document')),
  media_url TEXT,
  media_filename TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, status_key)
);

-- Add message fields to motoboy_tracking_statuses
ALTER TABLE public.motoboy_tracking_statuses 
  ADD COLUMN IF NOT EXISTS whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message_template TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'audio', 'document')),
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_filename TEXT;

-- Enable RLS on carrier_tracking_statuses
ALTER TABLE public.carrier_tracking_statuses ENABLE ROW LEVEL SECURITY;

-- RLS policies for carrier_tracking_statuses
CREATE POLICY "Users can view carrier statuses from their organization" 
  ON public.carrier_tracking_statuses FOR SELECT 
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage carrier statuses" 
  ON public.carrier_tracking_statuses FOR ALL 
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Function to initialize carrier tracking statuses for new organizations
CREATE OR REPLACE FUNCTION public.initialize_carrier_tracking_statuses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.carrier_tracking_statuses (organization_id, status_key, label, position)
  VALUES
    (NEW.id, 'waiting_post', 'Aguardando ser postado', 1),
    (NEW.id, 'posted', 'Postado corretamente', 2),
    (NEW.id, 'in_destination_city', 'Na cidade do cliente', 3),
    (NEW.id, 'attempt_1_failed', '1ª tentativa sem sucesso', 4),
    (NEW.id, 'attempt_2_failed', '2ª tentativa sem sucesso', 5),
    (NEW.id, 'attempt_3_failed', '3ª tentativa sem sucesso', 6),
    (NEW.id, 'waiting_pickup', 'Aguardando retirada no correio', 7),
    (NEW.id, 'returning_to_sender', 'Voltando para remetente', 8),
    (NEW.id, 'delivered', 'ENTREGUE', 9);
  RETURN NEW;
END;
$$;

-- Trigger to auto-initialize carrier statuses
DROP TRIGGER IF EXISTS init_carrier_tracking_statuses ON public.organizations;
CREATE TRIGGER init_carrier_tracking_statuses
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_carrier_tracking_statuses();

-- Initialize carrier tracking statuses for existing organizations that don't have them
INSERT INTO public.carrier_tracking_statuses (organization_id, status_key, label, position)
SELECT o.id, s.status_key, s.label, s.position
FROM public.organizations o
CROSS JOIN (
  VALUES 
    ('waiting_post', 'Aguardando ser postado', 1),
    ('posted', 'Postado corretamente', 2),
    ('in_destination_city', 'Na cidade do cliente', 3),
    ('attempt_1_failed', '1ª tentativa sem sucesso', 4),
    ('attempt_2_failed', '2ª tentativa sem sucesso', 5),
    ('attempt_3_failed', '3ª tentativa sem sucesso', 6),
    ('waiting_pickup', 'Aguardando retirada no correio', 7),
    ('returning_to_sender', 'Voltando para remetente', 8),
    ('delivered', 'ENTREGUE', 9)
) AS s(status_key, label, position)
WHERE NOT EXISTS (
  SELECT 1 FROM public.carrier_tracking_statuses cts 
  WHERE cts.organization_id = o.id AND cts.status_key = s.status_key
);