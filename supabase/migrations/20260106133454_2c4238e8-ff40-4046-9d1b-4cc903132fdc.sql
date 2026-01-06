-- Create motoboy tracking status enum
CREATE TYPE public.motoboy_tracking_status AS ENUM (
  'waiting_expedition',     -- Aguardando expedição fechar pedido
  'expedition_ready',       -- Expedição com pedido pronto
  'handed_to_motoboy',      -- Pedido entregue ao motoboy
  'next_delivery',          -- Próxima entrega
  'special_delay',          -- Atraso por motivo especial do motoboy
  'call_motoboy',           -- Ligar para motoboy
  'delivered',              -- Entregue
  'returned'                -- Voltou
);

-- Table for configurable motoboy tracking statuses per organization (with webhooks)
CREATE TABLE public.motoboy_tracking_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status_key TEXT NOT NULL,
  label TEXT NOT NULL,
  webhook_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, status_key)
);

-- Enable RLS
ALTER TABLE public.motoboy_tracking_statuses ENABLE ROW LEVEL SECURITY;

-- RLS policies for motoboy_tracking_statuses
CREATE POLICY "Users can view their org motoboy statuses" 
ON public.motoboy_tracking_statuses 
FOR SELECT 
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Admins can manage motoboy statuses" 
ON public.motoboy_tracking_statuses 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = motoboy_tracking_statuses.organization_id 
    AND user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- Table for motoboy tracking history (similar to sale_carrier_tracking)
CREATE TABLE public.sale_motoboy_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status public.motoboy_tracking_status NOT NULL,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sale_motoboy_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies for sale_motoboy_tracking
CREATE POLICY "Users can view their org motoboy tracking" 
ON public.sale_motoboy_tracking 
FOR SELECT 
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert motoboy tracking" 
ON public.sale_motoboy_tracking 
FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

-- Add motoboy tracking status column to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS motoboy_tracking_status public.motoboy_tracking_status;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sale_motoboy_tracking_sale_id ON public.sale_motoboy_tracking(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_motoboy_tracking_org_id ON public.sale_motoboy_tracking(organization_id);
CREATE INDEX IF NOT EXISTS idx_motoboy_tracking_statuses_org_id ON public.motoboy_tracking_statuses(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_motoboy_tracking_status ON public.sales(motoboy_tracking_status) WHERE motoboy_tracking_status IS NOT NULL;

-- Trigger for updated_at on motoboy_tracking_statuses
CREATE TRIGGER update_motoboy_tracking_statuses_updated_at
BEFORE UPDATE ON public.motoboy_tracking_statuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default motoboy tracking statuses for all organizations
INSERT INTO public.motoboy_tracking_statuses (organization_id, status_key, label, position)
SELECT 
  o.id,
  status_data.key,
  status_data.label,
  status_data.pos
FROM public.organizations o
CROSS JOIN (
  VALUES 
    ('waiting_expedition', 'Aguardando expedição fechar pedido', 1),
    ('expedition_ready', 'Expedição com pedido pronto', 2),
    ('handed_to_motoboy', 'Pedido entregue ao motoboy', 3),
    ('next_delivery', 'Próxima entrega', 4),
    ('special_delay', 'Atraso por motivo especial do motoboy', 5),
    ('call_motoboy', 'Ligar para motoboy', 6),
    ('delivered', 'Entregue', 7),
    ('returned', 'Voltou', 8)
) AS status_data(key, label, pos)
ON CONFLICT (organization_id, status_key) DO NOTHING;

-- Enable realtime for motoboy tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_motoboy_tracking;