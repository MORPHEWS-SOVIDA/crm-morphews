-- ETAPA 3: Tabela de checkouts vinculados à rede
CREATE TABLE public.affiliate_network_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES public.affiliate_networks(id) ON DELETE CASCADE,
  checkout_id UUID NOT NULL REFERENCES public.standalone_checkouts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(network_id, checkout_id)
);

CREATE INDEX idx_network_checkouts_network ON affiliate_network_checkouts(network_id);
CREATE INDEX idx_network_checkouts_checkout ON affiliate_network_checkouts(checkout_id);

ALTER TABLE affiliate_network_checkouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can manage network checkouts"
ON affiliate_network_checkouts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = affiliate_network_checkouts.organization_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Network members can view their checkouts"
ON affiliate_network_checkouts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM affiliate_network_members anm
    WHERE anm.network_id = affiliate_network_checkouts.network_id
    AND anm.user_id = auth.uid()
    AND anm.is_active = true
  )
);

-- Função RPC para aceitar convite de rede (pode ser chamada por authenticated)
CREATE OR REPLACE FUNCTION public.join_affiliate_network(
  p_invite_code TEXT,
  p_email TEXT,
  p_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_network affiliate_networks%ROWTYPE;
  v_affiliate organization_affiliates%ROWTYPE;
  v_member affiliate_network_members%ROWTYPE;
  v_user_id UUID;
BEGIN
  -- Pegar user_id do usuário autenticado
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;
  
  -- Buscar a rede pelo código
  SELECT * INTO v_network
  FROM affiliate_networks
  WHERE invite_code = p_invite_code AND is_active = true;
  
  IF v_network.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Rede não encontrada ou inativa');
  END IF;
  
  -- Verificar se já é membro
  SELECT * INTO v_member
  FROM affiliate_network_members
  WHERE network_id = v_network.id AND user_id = v_user_id;
  
  IF v_member.id IS NOT NULL THEN
    IF v_member.is_active THEN
      RETURN json_build_object('success', false, 'error', 'Você já é membro desta rede');
    ELSE
      -- Reativar membro
      UPDATE affiliate_network_members
      SET is_active = true
      WHERE id = v_member.id;
      
      RETURN json_build_object(
        'success', true,
        'network_id', v_network.id,
        'network_name', v_network.name,
        'member_id', v_member.id,
        'reactivated', true
      );
    END IF;
  END IF;
  
  -- Buscar ou criar afiliado na organização
  SELECT * INTO v_affiliate
  FROM organization_affiliates
  WHERE organization_id = v_network.organization_id
  AND (email = p_email OR user_id = v_user_id);
  
  IF v_affiliate.id IS NULL THEN
    -- Criar novo afiliado
    INSERT INTO organization_affiliates (
      organization_id, email, name, user_id, is_active
    ) VALUES (
      v_network.organization_id, p_email, p_name, v_user_id, true
    )
    RETURNING * INTO v_affiliate;
  ELSE
    -- Atualizar user_id se necessário
    IF v_affiliate.user_id IS NULL THEN
      UPDATE organization_affiliates
      SET user_id = v_user_id
      WHERE id = v_affiliate.id;
    END IF;
  END IF;
  
  -- Adicionar à rede
  INSERT INTO affiliate_network_members (
    network_id, user_id, organization_id, affiliate_id, role, commission_type, commission_value
  ) VALUES (
    v_network.id, v_user_id, v_network.organization_id, v_affiliate.id, 'affiliate', 'percentage', 10
  )
  RETURNING * INTO v_member;
  
  RETURN json_build_object(
    'success', true,
    'network_id', v_network.id,
    'network_name', v_network.name,
    'member_id', v_member.id
  );
END;
$$;