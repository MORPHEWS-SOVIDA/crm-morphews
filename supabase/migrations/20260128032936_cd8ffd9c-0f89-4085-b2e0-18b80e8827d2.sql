-- Fix: accept_partner_invitation must accept UUID invite_code (partner_invitations.invite_code is uuid)
-- Remove the broken overload (text) to avoid PostgREST picking it.
DROP FUNCTION IF EXISTS public.accept_partner_invitation(text, uuid);

CREATE OR REPLACE FUNCTION public.accept_partner_invitation(p_invite_code uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invitation partner_invitations%ROWTYPE;
  v_virtual_account_id UUID;
  v_partner_association_id UUID;
  v_affiliate_code TEXT;
  v_partner_role TEXT;
  v_default_perms JSONB;
BEGIN
  -- Buscar convite
  SELECT * INTO v_invitation
  FROM partner_invitations
  WHERE invite_code = p_invite_code AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite não encontrado ou já utilizado');
  END IF;

  -- Verificar expiração
  IF v_invitation.expires_at < now() THEN
    UPDATE partner_invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'Convite expirado');
  END IF;

  -- Mapear partner_type para role
  v_partner_role := get_partner_role(v_invitation.partner_type);

  -- Verificar/criar virtual_account
  SELECT id INTO v_virtual_account_id
  FROM virtual_accounts
  WHERE user_id = p_user_id;

  IF v_virtual_account_id IS NULL THEN
    INSERT INTO virtual_accounts (
      user_id,
      holder_name,
      holder_email,
      holder_document,
      balance_cents,
      pending_balance_cents
    ) VALUES (
      p_user_id,
      v_invitation.name,
      v_invitation.email,
      v_invitation.document,
      0,
      0
    )
    RETURNING id INTO v_virtual_account_id;
  END IF;

  -- Gerar código de afiliado único
  v_affiliate_code := 'P' || upper(substr(md5(v_invitation.id::text), 1, 8));

  -- Criar partner_association
  INSERT INTO partner_associations (
    virtual_account_id,
    organization_id,
    partner_type,
    commission_type,
    commission_value,
    responsible_for_refunds,
    responsible_for_chargebacks,
    linked_product_id,
    linked_landing_id,
    linked_checkout_id,
    affiliate_code,
    is_active
  ) VALUES (
    v_virtual_account_id,
    v_invitation.organization_id,
    v_invitation.partner_type,
    v_invitation.commission_type,
    v_invitation.commission_value,
    v_invitation.responsible_for_refunds,
    v_invitation.responsible_for_chargebacks,
    v_invitation.linked_product_id,
    v_invitation.linked_landing_id,
    v_invitation.linked_checkout_id,
    v_affiliate_code,
    true
  )
  RETURNING id INTO v_partner_association_id;

  -- Atualizar convite
  UPDATE partner_invitations
  SET 
    status = 'accepted',
    accepted_at = now(),
    accepted_by_user_id = p_user_id,
    updated_at = now()
  WHERE id = v_invitation.id;

  -- Atualizar profile (flag)
  UPDATE profiles
  SET is_partner = true, updated_at = now()
  WHERE user_id = p_user_id;

  -- Criar organization_member com role de parceiro
  INSERT INTO organization_members (
    user_id,
    organization_id,
    role
  ) VALUES (
    p_user_id,
    v_invitation.organization_id,
    v_partner_role
  )
  ON CONFLICT (user_id, organization_id) DO UPDATE
  SET role = v_partner_role, updated_at = now();

  -- Buscar permissões padrão do perfil de parceiro
  v_default_perms := get_default_permissions_for_role(v_partner_role);

  -- Criar/atualizar user_permissions com permissões do parceiro
  INSERT INTO user_permissions (user_id, organization_id)
  VALUES (p_user_id, v_invitation.organization_id)
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  -- Aplicar permissões (bloco inicial; mantemos o restante como já estava na versão anterior)
  UPDATE user_permissions
  SET 
    leads_view = COALESCE((v_default_perms->>'leads_view')::boolean, false),
    leads_view_only_own = COALESCE((v_default_perms->>'leads_view_only_own')::boolean, true),
    leads_create = COALESCE((v_default_perms->>'leads_create')::boolean, false),
    leads_edit = COALESCE((v_default_perms->>'leads_edit')::boolean, false),
    leads_delete = COALESCE((v_default_perms->>'leads_delete')::boolean, false),
    leads_hide_new_button = COALESCE((v_default_perms->>'leads_hide_new_button')::boolean, true),
    sales_view = COALESCE((v_default_perms->>'sales_view')::boolean, true),
    sales_view_only_own = COALESCE((v_default_perms->>'sales_view_only_own')::boolean, true),
    updated_at = now()
  WHERE user_id = p_user_id AND organization_id = v_invitation.organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'affiliate_code', v_affiliate_code,
    'partner_association_id', v_partner_association_id
  );
END;
$$;