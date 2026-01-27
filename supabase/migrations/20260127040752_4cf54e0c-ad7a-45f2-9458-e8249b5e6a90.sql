-- Fix partner approval: ensure virtual_accounts.account_type is set when creating the account
CREATE OR REPLACE FUNCTION public.approve_partner_application(p_application_id uuid, p_reviewer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_application partner_applications%ROWTYPE;
  v_user_id UUID;
  v_virtual_account_id UUID;
  v_partner_association_id UUID;
  v_affiliate_code TEXT;
  v_temp_password TEXT;
  v_org_name TEXT;
  v_partner_role TEXT;
  v_account_type TEXT;
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

  -- Mapear partner_type para role
  v_partner_role := get_partner_role(v_application.partner_type);

  -- Mapear partner_type para account_type (coluna NOT NULL em virtual_accounts)
  v_account_type := CASE
    WHEN v_application.partner_type IN ('tenant','affiliate','coproducer','factory','industry','platform')
      THEN v_application.partner_type
    ELSE 'affiliate'
  END;

  -- Gerar senha temporária
  v_temp_password := 'Morph' || substr(md5(random()::text), 1, 6) || '!';

  -- Verificar se usuário já existe pelo email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_application.email;

  -- Verificar/criar virtual_account
  IF v_user_id IS NOT NULL THEN
    SELECT id INTO v_virtual_account_id
    FROM virtual_accounts
    WHERE user_id = v_user_id;
  END IF;

  IF v_virtual_account_id IS NULL THEN
    INSERT INTO virtual_accounts (
      user_id,
      account_type,
      holder_name,
      holder_email,
      holder_document,
      balance_cents,
      pending_balance_cents
    ) VALUES (
      v_user_id,
      v_account_type,
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
    'needs_user_creation', v_user_id IS NULL,
    'partner_role', v_partner_role
  );
END;
$function$;