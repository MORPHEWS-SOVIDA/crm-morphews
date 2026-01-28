-- ETAPA 1: Criar tabela de redes de afiliados
CREATE TABLE public.affiliate_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  invite_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_affiliate_networks_org ON affiliate_networks(organization_id);
CREATE INDEX idx_affiliate_networks_invite_code ON affiliate_networks(invite_code);

ALTER TABLE affiliate_networks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage affiliate networks"
ON affiliate_networks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = affiliate_networks.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Anon can view active networks by invite code"
ON affiliate_networks FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY "Authenticated can view active networks"
ON affiliate_networks FOR SELECT
TO authenticated
USING (is_active = true);

CREATE TRIGGER update_affiliate_networks_updated_at
  BEFORE UPDATE ON affiliate_networks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();