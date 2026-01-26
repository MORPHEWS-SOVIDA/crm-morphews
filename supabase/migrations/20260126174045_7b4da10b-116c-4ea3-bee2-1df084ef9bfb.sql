-- =====================================================
-- SISTEMA DE PARCEIROS MORPHEWS - COMPLETO
-- Convites, Portal do Parceiro, Associações Multi-tenant
-- =====================================================

-- 1) Partner invitations table
CREATE TABLE IF NOT EXISTS public.partner_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Invitation details
  invite_code UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('affiliate', 'coproducer', 'industry', 'factory')),
  
  -- Invitee info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  document TEXT,
  
  -- Commission settings (to be applied when accepted)
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value NUMERIC NOT NULL DEFAULT 0,
  responsible_for_refunds BOOLEAN DEFAULT true,
  responsible_for_chargebacks BOOLEAN DEFAULT true,
  
  -- Optional: link to specific product/landing/checkout
  linked_product_id UUID REFERENCES lead_products(id) ON DELETE SET NULL,
  linked_landing_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,
  linked_checkout_id UUID REFERENCES standalone_checkouts(id) ON DELETE SET NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) Partner associations - links a user to multiple tenants/products
CREATE TABLE IF NOT EXISTS public.partner_associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  virtual_account_id UUID REFERENCES virtual_accounts(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  partner_type TEXT NOT NULL CHECK (partner_type IN ('affiliate', 'coproducer', 'industry', 'factory')),
  
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value NUMERIC NOT NULL DEFAULT 0,
  responsible_for_refunds BOOLEAN DEFAULT true,
  responsible_for_chargebacks BOOLEAN DEFAULT true,
  
  linked_product_id UUID REFERENCES lead_products(id) ON DELETE SET NULL,
  linked_landing_id UUID REFERENCES landing_pages(id) ON DELETE SET NULL,
  linked_checkout_id UUID REFERENCES standalone_checkouts(id) ON DELETE SET NULL,
  
  affiliate_code TEXT,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (virtual_account_id, organization_id, partner_type, linked_product_id)
);

-- 3) Update profiles for partner support
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_virtual_account_id UUID REFERENCES virtual_accounts(id) ON DELETE SET NULL;

-- 4) Enable RLS
ALTER TABLE public.partner_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_associations ENABLE ROW LEVEL SECURITY;

-- 5) Policies for partner_invitations
CREATE POLICY "Org admins can manage partner invitations"
ON public.partner_invitations FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Partners can view their accepted invitations"
ON public.partner_invitations FOR SELECT
USING (accepted_by_user_id = auth.uid());

CREATE POLICY "Anyone can view pending invitation by code"
ON public.partner_invitations FOR SELECT
USING (status = 'pending' AND expires_at > now());

-- 6) Policies for partner_associations
CREATE POLICY "Org admins can manage partner associations"
ON public.partner_associations FOR ALL
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Partners can view their associations"
ON public.partner_associations FOR SELECT
USING (
  virtual_account_id IN (
    SELECT id FROM public.virtual_accounts WHERE user_id = auth.uid()
  )
);

-- 7) Indexes
CREATE INDEX IF NOT EXISTS idx_partner_invitations_code ON public.partner_invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_partner_invitations_email ON public.partner_invitations(email);
CREATE INDEX IF NOT EXISTS idx_partner_invitations_status ON public.partner_invitations(status);
CREATE INDEX IF NOT EXISTS idx_partner_associations_virtual_account ON public.partner_associations(virtual_account_id);
CREATE INDEX IF NOT EXISTS idx_partner_associations_org ON public.partner_associations(organization_id);
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_user_id ON public.virtual_accounts(user_id);

-- 8) Function to accept invitation
CREATE OR REPLACE FUNCTION public.accept_partner_invitation(
  p_invite_code UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_virtual_account_id UUID;
  v_association_id UUID;
  v_affiliate_code TEXT;
BEGIN
  SELECT * INTO v_invitation
  FROM partner_invitations
  WHERE invite_code = p_invite_code
    AND status = 'pending'
    AND expires_at > now()
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Convite não encontrado, expirado ou já utilizado');
  END IF;
  
  SELECT id INTO v_virtual_account_id
  FROM virtual_accounts
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF v_virtual_account_id IS NULL THEN
    INSERT INTO virtual_accounts (
      organization_id, account_type, user_id,
      holder_name, holder_email, holder_document
    ) VALUES (
      v_invitation.organization_id, v_invitation.partner_type, p_user_id,
      v_invitation.name, v_invitation.email, v_invitation.document
    )
    RETURNING id INTO v_virtual_account_id;
  END IF;
  
  IF v_invitation.partner_type = 'affiliate' THEN
    v_affiliate_code := upper(substring(md5(random()::text), 1, 8));
  END IF;
  
  INSERT INTO partner_associations (
    virtual_account_id, organization_id, partner_type,
    commission_type, commission_value,
    responsible_for_refunds, responsible_for_chargebacks,
    linked_product_id, linked_landing_id, linked_checkout_id,
    affiliate_code
  ) VALUES (
    v_virtual_account_id, v_invitation.organization_id, v_invitation.partner_type,
    v_invitation.commission_type, v_invitation.commission_value,
    v_invitation.responsible_for_refunds, v_invitation.responsible_for_chargebacks,
    v_invitation.linked_product_id, v_invitation.linked_landing_id, v_invitation.linked_checkout_id,
    v_affiliate_code
  )
  RETURNING id INTO v_association_id;
  
  UPDATE partner_invitations
  SET status = 'accepted', accepted_at = now(), 
      accepted_by_user_id = p_user_id, updated_at = now()
  WHERE id = v_invitation.id;
  
  UPDATE profiles
  SET is_partner = true, partner_virtual_account_id = v_virtual_account_id
  WHERE user_id = p_user_id;
  
  RETURN json_build_object(
    'success', true,
    'virtual_account_id', v_virtual_account_id,
    'association_id', v_association_id,
    'affiliate_code', v_affiliate_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_partner_invitation(UUID, UUID) TO authenticated;