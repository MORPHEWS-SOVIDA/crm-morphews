
-- Fix accept_partner_invitation function - add missing account_type to virtual_accounts INSERT
CREATE OR REPLACE FUNCTION public.accept_partner_invitation(
  p_invite_code TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_virtual_account_id UUID;
  v_account_type TEXT;
  v_user_email TEXT;
  v_user_name TEXT;
BEGIN
  -- Get invitation
  SELECT * INTO v_invitation
  FROM partner_invitations
  WHERE invite_code = p_invite_code
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite não encontrado ou já utilizado');
  END IF;

  -- Check expiration
  IF v_invitation.expires_at < NOW() THEN
    UPDATE partner_invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'Convite expirado');
  END IF;

  -- Get user info
  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  v_user_name := v_invitation.name;

  -- Map partner_type to account_type
  v_account_type := CASE v_invitation.partner_type
    WHEN 'affiliate' THEN 'affiliate'
    WHEN 'coproducer' THEN 'coproducer'
    WHEN 'industry' THEN 'industry'
    WHEN 'factory' THEN 'factory'
    ELSE 'coproducer'
  END;

  -- Create virtual account with all required fields
  INSERT INTO virtual_accounts (
    organization_id,
    user_id,
    account_type,
    holder_name,
    holder_email,
    holder_whatsapp,
    holder_document,
    balance_cents,
    pending_balance_cents,
    is_active
  ) VALUES (
    v_invitation.organization_id,
    p_user_id,
    v_account_type,
    v_user_name,
    v_invitation.email,
    v_invitation.whatsapp,
    v_invitation.document,
    0,
    0,
    true
  )
  RETURNING id INTO v_virtual_account_id;

  -- Create partner association
  INSERT INTO partner_associations (
    organization_id,
    virtual_account_id,
    partner_type,
    commission_type,
    commission_value,
    responsible_for_refunds,
    responsible_for_chargebacks,
    is_active
  ) VALUES (
    v_invitation.organization_id,
    v_virtual_account_id,
    v_invitation.partner_type,
    v_invitation.commission_type,
    v_invitation.commission_value,
    COALESCE(v_invitation.responsible_for_refunds, false),
    COALESCE(v_invitation.responsible_for_chargebacks, false),
    true
  );

  -- Add user as organization member with partner role
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_invitation.organization_id, p_user_id, 'partner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- Grant default partner permissions
  INSERT INTO user_permissions (user_id, organization_id, permission_key, granted)
  VALUES 
    (p_user_id, v_invitation.organization_id, 'sales_view', true),
    (p_user_id, v_invitation.organization_id, 'leads_view_only_own', true),
    (p_user_id, v_invitation.organization_id, 'whatsapp_inbox_view', true)
  ON CONFLICT (user_id, organization_id, permission_key) DO UPDATE SET granted = true;

  -- Mark invitation as accepted
  UPDATE partner_invitations 
  SET status = 'accepted', accepted_at = NOW(), accepted_by_user_id = p_user_id
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true, 
    'organization_id', v_invitation.organization_id,
    'virtual_account_id', v_virtual_account_id,
    'partner_type', v_invitation.partner_type
  );
END;
$$;
