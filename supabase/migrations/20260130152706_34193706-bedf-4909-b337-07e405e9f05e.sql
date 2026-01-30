-- Create affiliate_network_landings table (links networks to landing pages)
CREATE TABLE public.affiliate_network_landings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL REFERENCES public.affiliate_networks(id) ON DELETE CASCADE,
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_network_landing UNIQUE (network_id, landing_page_id)
);

-- Enable Row Level Security
ALTER TABLE public.affiliate_network_landings ENABLE ROW LEVEL SECURITY;

-- RLS: Org admins can manage network landings
CREATE POLICY "Org admins can manage network landings"
ON public.affiliate_network_landings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = affiliate_network_landings.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- RLS: Network members can view their landings
CREATE POLICY "Network members can view their landings"
ON public.affiliate_network_landings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM affiliate_network_members anm
    WHERE anm.network_id = affiliate_network_landings.network_id
    AND anm.user_id = auth.uid()
    AND anm.is_active = true
  )
);

-- Create index for better performance
CREATE INDEX idx_affiliate_network_landings_network_id ON public.affiliate_network_landings(network_id);
CREATE INDEX idx_affiliate_network_landings_landing_page_id ON public.affiliate_network_landings(landing_page_id);
CREATE INDEX idx_affiliate_network_landings_organization_id ON public.affiliate_network_landings(organization_id);