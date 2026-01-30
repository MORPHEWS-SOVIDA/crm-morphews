-- =====================================================
-- MIGRATION: Update accept_partner_invitation to NOT create organization_members
-- Partners should only exist in organization_affiliates + partner_associations
-- =====================================================

CREATE OR REPLACE FUNCTION public.accept_partner_invitation(p_invite_code uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_invitation public.partner_invitations%ROWTYPE;
  v_virtual_account_id uuid;
  v_partner_association_id uuid;
  v_affiliate_code text;
  v_account_type text;
  v_org_affiliate_id uuid;
BEGIN
  SELECT * INTO v_invitation
  FROM public.partner_invitations
  WHERE invite_code = p_invite_code
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite não encontrado ou já utilizado');
  END IF;

  IF v_invitation.expires_at < now() THEN
    UPDATE public.partner_invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'Convite expirado');
  END IF;

  v_account_type := CASE v_invitation.partner_type
    WHEN 'affiliate' THEN 'affiliate'
    WHEN 'coproducer' THEN 'coproducer'
    WHEN 'industry' THEN 'industry'
    WHEN 'factory' THEN 'factory'
    ELSE 'coproducer'
  END;

  -- Get or create virtual account
  SELECT id INTO v_virtual_account_id
  FROM public.virtual_accounts
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_virtual_account_id IS NULL THEN
    INSERT INTO public.virtual_accounts (
      organization_id,
      user_id,
      account_type,
      holder_name,
      holder_email,
      holder_document,
      balance_cents,
      pending_balance_cents,
      is_active
    ) VALUES (
      v_invitation.organization_id,
      p_user_id,
      v_account_type,
      v_invitation.name,
      v_invitation.email,
      v_invitation.document,
      0,
      0,
      true
    )
    RETURNING id INTO v_virtual_account_id;
  END IF;

  v_affiliate_code := 'P' || upper(substr(md5(v_invitation.id::text), 1, 8));

  -- Create partner association
  INSERT INTO public.partner_associations (
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

  -- Mark invitation as accepted
  UPDATE public.partner_invitations
  SET 
    status = 'accepted',
    accepted_at = now(),
    accepted_by_user_id = p_user_id,
    updated_at = now()
  WHERE id = v_invitation.id;

  -- Mark profile as partner
  UPDATE public.profiles
  SET is_partner = true, updated_at = now()
  WHERE user_id = p_user_id;

  -- If this is an affiliate, also create in organization_affiliates for the new flow
  IF v_invitation.partner_type = 'affiliate' THEN
    INSERT INTO public.organization_affiliates (
      organization_id,
      email,
      name,
      phone,
      user_id,
      default_commission_type,
      default_commission_value,
      is_active
    ) VALUES (
      v_invitation.organization_id,
      v_invitation.email,
      v_invitation.name,
      v_invitation.whatsapp,
      p_user_id,
      v_invitation.commission_type,
      v_invitation.commission_value,
      true
    )
    ON CONFLICT (organization_id, email) 
    DO UPDATE SET 
      user_id = p_user_id,
      is_active = true,
      updated_at = now()
    RETURNING id INTO v_org_affiliate_id;
  END IF;

  -- DO NOT create organization_members for partners anymore!
  -- Partners are external entities, not team members

  RETURN jsonb_build_object(
    'success', true,
    'affiliate_code', v_affiliate_code,
    'partner_association_id', v_partner_association_id
  );
END;
$function$;