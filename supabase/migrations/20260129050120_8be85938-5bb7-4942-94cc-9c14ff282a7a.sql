-- Tabela para vincular Storefronts (Lojas) às redes de afiliados
CREATE TABLE public.affiliate_network_storefronts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.affiliate_networks(id) ON DELETE CASCADE,
  storefront_id UUID NOT NULL REFERENCES public.tenant_storefronts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(network_id, storefront_id)
);

-- RLS
ALTER TABLE public.affiliate_network_storefronts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage network storefronts"
ON public.affiliate_network_storefronts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = affiliate_network_storefronts.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Affiliates can view network storefronts"
ON public.affiliate_network_storefronts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM affiliate_network_members
    WHERE affiliate_network_members.network_id = affiliate_network_storefronts.network_id
    AND affiliate_network_members.user_id = auth.uid()
    AND affiliate_network_members.is_active = true
  )
);