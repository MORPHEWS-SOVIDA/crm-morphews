-- =============================================
-- SISTEMA DE LINKS PÚBLICOS DE PARCERIA
-- =============================================

-- Tabela para links públicos de convite em massa
CREATE TABLE public.partner_public_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  
  -- Identificação do link
  slug TEXT NOT NULL, -- ex: "sovida", "morphews"
  name TEXT NOT NULL, -- Nome descritivo: "Link Evento X"
  
  -- Configurações do parceiro que virá por este link
  partner_type TEXT NOT NULL DEFAULT 'affiliate' CHECK (partner_type IN ('affiliate', 'coproducer', 'industry', 'factory')),
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value NUMERIC NOT NULL DEFAULT 0,
  responsible_for_refunds BOOLEAN NOT NULL DEFAULT false,
  responsible_for_chargebacks BOOLEAN NOT NULL DEFAULT false,
  
  -- Vínculo opcional a produto/landing/checkout
  linked_product_id UUID REFERENCES public.lead_products(id) ON DELETE SET NULL,
  linked_landing_id UUID REFERENCES public.landing_pages(id) ON DELETE SET NULL,
  linked_checkout_id UUID REFERENCES public.standalone_checkouts(id) ON DELETE SET NULL,
  
  -- Controle
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  max_registrations INTEGER, -- limite de cadastros (null = ilimitado)
  registrations_count INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Slug único por organização
  CONSTRAINT partner_public_links_org_slug_unique UNIQUE (organization_id, slug)
);

-- Tabela para solicitações de parceria (via link público)
CREATE TABLE public.partner_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_link_id UUID NOT NULL REFERENCES public.partner_public_links(id) ON DELETE CASCADE,
  
  -- Dados do interessado
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  document TEXT, -- CPF/CNPJ
  
  -- Dados herdados do link
  partner_type TEXT NOT NULL,
  commission_type TEXT NOT NULL,
  commission_value NUMERIC NOT NULL,
  responsible_for_refunds BOOLEAN NOT NULL DEFAULT false,
  responsible_for_chargebacks BOOLEAN NOT NULL DEFAULT false,
  
  -- Status do processo
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Após aprovação
  accepted_by_user_id UUID REFERENCES auth.users(id),
  virtual_account_id UUID REFERENCES public.virtual_accounts(id),
  partner_association_id UUID REFERENCES public.partner_associations(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar coluna para rastrear origem do convite manual
ALTER TABLE public.partner_invitations 
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notification_type TEXT; -- 'email', 'whatsapp', 'both'

-- Enable RLS
ALTER TABLE public.partner_public_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

-- Políticas para partner_public_links
CREATE POLICY "Org members can view their public links"
ON public.partner_public_links FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Org members can create public links"
ON public.partner_public_links FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Org members can update their public links"
ON public.partner_public_links FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Org members can delete their public links"
ON public.partner_public_links FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Política pública para leitura do link (para página de cadastro)
CREATE POLICY "Anyone can view active public links by slug"
ON public.partner_public_links FOR SELECT
USING (is_active = true);

-- Políticas para partner_applications
CREATE POLICY "Org members can view applications"
ON public.partner_applications FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can create applications"
ON public.partner_applications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Org members can update applications"
ON public.partner_applications FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Função para aprovar solicitação de parceria
CREATE OR REPLACE FUNCTION public.approve_partner_application(
  p_application_id UUID,
  p_reviewer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application partner_applications%ROWTYPE;
  v_user_id UUID;
  v_virtual_account_id UUID;
  v_partner_association_id UUID;
  v_affiliate_code TEXT;
  v_temp_password TEXT;
  v_org_name TEXT;
BEGIN
  -- Buscar solicitação
  SELECT * INTO v_application
  FROM partner_applications
  WHERE id = p_application_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada ou já processada');
  END IF;
  
  -- Buscar nome da organização
  SELECT name INTO v_org_name FROM organizations WHERE id = v_application.organization_id;
  
  -- Gerar senha temporária
  v_temp_password := 'Morph' || substr(md5(random()::text), 1, 6) || '!';
  
  -- Verificar se usuário já existe pelo email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_application.email;
  
  -- Se não existe, criar usuário (isso será feito via edge function)
  -- Por enquanto, apenas marcamos para criar
  
  -- Verificar/criar virtual_account
  IF v_user_id IS NOT NULL THEN
    SELECT id INTO v_virtual_account_id
    FROM virtual_accounts
    WHERE user_id = v_user_id;
  END IF;
  
  IF v_virtual_account_id IS NULL THEN
    INSERT INTO virtual_accounts (
      user_id,
      holder_name,
      holder_email,
      holder_document,
      balance_cents,
      pending_balance_cents
    ) VALUES (
      v_user_id,
      v_application.name,
      v_application.email,
      v_application.document,
      0,
      0
    )
    RETURNING id INTO v_virtual_account_id;
  END IF;
  
  -- Gerar código de afiliado único
  v_affiliate_code := 'P' || upper(substr(md5(v_application.id::text), 1, 8));
  
  -- Criar partner_association
  INSERT INTO partner_associations (
    virtual_account_id,
    organization_id,
    partner_type,
    commission_type,
    commission_value,
    responsible_for_refunds,
    responsible_for_chargebacks,
    affiliate_code,
    is_active
  ) VALUES (
    v_virtual_account_id,
    v_application.organization_id,
    v_application.partner_type,
    v_application.commission_type,
    v_application.commission_value,
    v_application.responsible_for_refunds,
    v_application.responsible_for_chargebacks,
    v_affiliate_code,
    true
  )
  RETURNING id INTO v_partner_association_id;
  
  -- Atualizar solicitação
  UPDATE partner_applications
  SET 
    status = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = now(),
    accepted_by_user_id = v_user_id,
    virtual_account_id = v_virtual_account_id,
    partner_association_id = v_partner_association_id,
    updated_at = now()
  WHERE id = p_application_id;
  
  -- Incrementar contador do link
  UPDATE partner_public_links
  SET registrations_count = registrations_count + 1
  WHERE id = v_application.public_link_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'virtual_account_id', v_virtual_account_id,
    'partner_association_id', v_partner_association_id,
    'affiliate_code', v_affiliate_code,
    'temp_password', v_temp_password,
    'email', v_application.email,
    'name', v_application.name,
    'whatsapp', v_application.whatsapp,
    'org_name', v_org_name,
    'needs_user_creation', v_user_id IS NULL
  );
END;
$$;

-- Função para buscar link público por slug (pública)
CREATE OR REPLACE FUNCTION public.get_partner_public_link(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link partner_public_links%ROWTYPE;
  v_org_name TEXT;
BEGIN
  SELECT * INTO v_link
  FROM partner_public_links
  WHERE slug = p_slug
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_registrations IS NULL OR registrations_count < max_registrations);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link não encontrado ou expirado');
  END IF;
  
  -- Buscar nome da organização
  SELECT name INTO v_org_name FROM organizations WHERE id = v_link.organization_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'link', jsonb_build_object(
      'id', v_link.id,
      'organization_id', v_link.organization_id,
      'organization_name', v_org_name,
      'name', v_link.name,
      'partner_type', v_link.partner_type,
      'commission_type', v_link.commission_type,
      'commission_value', v_link.commission_value
    )
  );
END;
$$;

-- Índices para performance
CREATE INDEX idx_partner_public_links_slug ON public.partner_public_links(slug);
CREATE INDEX idx_partner_public_links_org ON public.partner_public_links(organization_id);
CREATE INDEX idx_partner_applications_org ON public.partner_applications(organization_id);
CREATE INDEX idx_partner_applications_status ON public.partner_applications(status);
CREATE INDEX idx_partner_applications_link ON public.partner_applications(public_link_id);

-- Trigger para updated_at
CREATE TRIGGER update_partner_public_links_updated_at
BEFORE UPDATE ON public.partner_public_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_applications_updated_at
BEFORE UPDATE ON public.partner_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();