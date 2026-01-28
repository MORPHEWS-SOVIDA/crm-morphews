-- ETAPA 2: Tabela de membros da rede (afiliados e gerentes)
CREATE TABLE public.affiliate_network_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.affiliate_networks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  affiliate_id UUID REFERENCES public.organization_affiliates(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'affiliate' CHECK (role IN ('affiliate', 'manager')),
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value NUMERIC NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by UUID REFERENCES auth.users(id),
  UNIQUE(network_id, user_id)
);

CREATE INDEX idx_network_members_network ON affiliate_network_members(network_id);
CREATE INDEX idx_network_members_user ON affiliate_network_members(user_id);
CREATE INDEX idx_network_members_affiliate ON affiliate_network_members(affiliate_id);

ALTER TABLE affiliate_network_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage network members"
ON affiliate_network_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = affiliate_network_members.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Network managers can view their network members"
ON affiliate_network_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM affiliate_network_members manager
    WHERE manager.network_id = affiliate_network_members.network_id
    AND manager.user_id = auth.uid()
    AND manager.role = 'manager'
    AND manager.is_active = true
  )
);

CREATE POLICY "Members can view own membership"
ON affiliate_network_members FOR SELECT
USING (user_id = auth.uid());