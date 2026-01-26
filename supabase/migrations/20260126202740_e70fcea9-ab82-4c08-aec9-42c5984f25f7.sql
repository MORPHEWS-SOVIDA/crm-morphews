-- =============================================
-- PERFIS DE PERMISSÕES PARA PARCEIROS
-- =============================================

-- Adicionar novo tipo de role para parceiros
-- Os 4 tipos de parceiro terão permissões mapeadas automaticamente

-- Atualizar função get_default_permissions_for_role para incluir perfis de parceiro
CREATE OR REPLACE FUNCTION public.get_default_permissions_for_role(p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Perfis existentes
  IF p_role = 'owner' THEN
    result := jsonb_build_object(
      'leads_view', true, 'leads_view_only_own', false, 'leads_create', true, 'leads_edit', true, 'leads_delete', true, 'leads_hide_new_button', false,
      'sales_view', true, 'sales_view_only_own', false, 'sales_create', true, 'sales_edit', true, 'sales_delete', true,
      'products_view', true, 'products_create', true, 'products_edit', true, 'products_delete', true,
      'team_view', true, 'team_create', true, 'team_edit', true, 'team_edit_member', true, 'team_delete', true,
      'settings_view', true, 'settings_edit', true,
      'whatsapp_view', true, 'whatsapp_manage', true, 'whatsapp_ai_settings_view', true, 'whatsapp_ai_settings_edit', true,
      'instagram_view', true, 'instagram_manage', true,
      'post_sale_view', true, 'post_sale_create', true, 'post_sale_edit', true,
      'sac_view', true, 'sac_create', true, 'sac_edit', true,
      'dashboard_view', true, 'dashboard_kanban_view', true,
      'fiscal_view', true, 'fiscal_create', true, 'fiscal_edit', true,
      'financial_view', true, 'financial_edit', true,
      'expedition_view', true, 'expedition_create', true, 'expedition_edit', true, 'expedition_delete', true,
      'reports_view', true,
      'integrations_view', true, 'integrations_edit', true,
      'commissions_view', true, 'commissions_edit', true,
      'helper_donna_view', true,
      'ecommerce_view', true, 'ecommerce_manage', true, 'storefronts_manage', true, 'landing_pages_manage', true,
      'affiliates_view', true, 'affiliates_manage', true, 'payment_gateways_manage', true, 'virtual_wallet_view', true,
      'telesales_view', true, 'telesales_manage', true,
      'ai_sales_chatbot_view', true, 'ai_sales_leads_view', true,
      'demands_view', true, 'demands_create', true, 'demands_edit', true, 'demands_delete', true, 'demands_settings', true
    );
  ELSIF p_role = 'admin' THEN
    result := jsonb_build_object(
      'leads_view', true, 'leads_view_only_own', false, 'leads_create', true, 'leads_edit', true, 'leads_delete', true, 'leads_hide_new_button', false,
      'sales_view', true, 'sales_view_only_own', false, 'sales_create', true, 'sales_edit', true, 'sales_delete', false,
      'products_view', true, 'products_create', true, 'products_edit', true, 'products_delete', false,
      'team_view', true, 'team_create', true, 'team_edit', true, 'team_edit_member', true, 'team_delete', false,
      'settings_view', true, 'settings_edit', true,
      'whatsapp_view', true, 'whatsapp_manage', true, 'whatsapp_ai_settings_view', true, 'whatsapp_ai_settings_edit', false,
      'instagram_view', true, 'instagram_manage', true,
      'post_sale_view', true, 'post_sale_create', true, 'post_sale_edit', true,
      'sac_view', true, 'sac_create', true, 'sac_edit', true,
      'dashboard_view', true, 'dashboard_kanban_view', true,
      'fiscal_view', true, 'fiscal_create', true, 'fiscal_edit', true,
      'financial_view', true, 'financial_edit', false,
      'expedition_view', true, 'expedition_create', true, 'expedition_edit', true, 'expedition_delete', false,
      'reports_view', true,
      'integrations_view', true, 'integrations_edit', true,
      'commissions_view', true, 'commissions_edit', false,
      'helper_donna_view', true,
      'ecommerce_view', true, 'ecommerce_manage', true, 'storefronts_manage', true, 'landing_pages_manage', true,
      'affiliates_view', true, 'affiliates_manage', true, 'payment_gateways_manage', false, 'virtual_wallet_view', true,
      'telesales_view', true, 'telesales_manage', true,
      'ai_sales_chatbot_view', true, 'ai_sales_leads_view', true,
      'demands_view', true, 'demands_create', true, 'demands_edit', true, 'demands_delete', false, 'demands_settings', false
    );
  ELSIF p_role = 'manager' THEN
    result := jsonb_build_object(
      'leads_view', true, 'leads_view_only_own', false, 'leads_create', true, 'leads_edit', true, 'leads_delete', false, 'leads_hide_new_button', false,
      'sales_view', true, 'sales_view_only_own', false, 'sales_create', true, 'sales_edit', true, 'sales_delete', false,
      'products_view', true, 'products_create', false, 'products_edit', false, 'products_delete', false,
      'team_view', true, 'team_create', false, 'team_edit', false, 'team_edit_member', true, 'team_delete', false,
      'settings_view', true, 'settings_edit', false,
      'whatsapp_view', true, 'whatsapp_manage', false, 'whatsapp_ai_settings_view', false, 'whatsapp_ai_settings_edit', false,
      'instagram_view', true, 'instagram_manage', false,
      'post_sale_view', true, 'post_sale_create', true, 'post_sale_edit', true,
      'sac_view', true, 'sac_create', true, 'sac_edit', true,
      'dashboard_view', true, 'dashboard_kanban_view', true,
      'fiscal_view', false, 'fiscal_create', false, 'fiscal_edit', false,
      'financial_view', false, 'financial_edit', false,
      'expedition_view', true, 'expedition_create', true, 'expedition_edit', true, 'expedition_delete', false,
      'reports_view', true,
      'integrations_view', false, 'integrations_edit', false,
      'commissions_view', true, 'commissions_edit', false,
      'helper_donna_view', true,
      'ecommerce_view', true, 'ecommerce_manage', false, 'storefronts_manage', false, 'landing_pages_manage', false,
      'affiliates_view', true, 'affiliates_manage', false, 'payment_gateways_manage', false, 'virtual_wallet_view', true,
      'telesales_view', true, 'telesales_manage', true,
      'ai_sales_chatbot_view', true, 'ai_sales_leads_view', true,
      'demands_view', true, 'demands_create', true, 'demands_edit', true, 'demands_delete', false, 'demands_settings', false
    );
  ELSIF p_role = 'member' THEN
    result := jsonb_build_object(
      'leads_view', true, 'leads_view_only_own', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', false, 'leads_hide_new_button', false,
      'sales_view', true, 'sales_view_only_own', true, 'sales_create', true, 'sales_edit', false, 'sales_delete', false,
      'products_view', true, 'products_create', false, 'products_edit', false, 'products_delete', false,
      'team_view', false, 'team_create', false, 'team_edit', false, 'team_edit_member', false, 'team_delete', false,
      'settings_view', false, 'settings_edit', false,
      'whatsapp_view', true, 'whatsapp_manage', false, 'whatsapp_ai_settings_view', false, 'whatsapp_ai_settings_edit', false,
      'instagram_view', false, 'instagram_manage', false,
      'post_sale_view', true, 'post_sale_create', true, 'post_sale_edit', false,
      'sac_view', true, 'sac_create', true, 'sac_edit', false,
      'dashboard_view', true, 'dashboard_kanban_view', true,
      'fiscal_view', false, 'fiscal_create', false, 'fiscal_edit', false,
      'financial_view', false, 'financial_edit', false,
      'expedition_view', false, 'expedition_create', false, 'expedition_edit', false, 'expedition_delete', false,
      'reports_view', false,
      'integrations_view', false, 'integrations_edit', false,
      'commissions_view', false, 'commissions_edit', false,
      'helper_donna_view', true,
      'ecommerce_view', false, 'ecommerce_manage', false, 'storefronts_manage', false, 'landing_pages_manage', false,
      'affiliates_view', false, 'affiliates_manage', false, 'payment_gateways_manage', false, 'virtual_wallet_view', false,
      'telesales_view', true, 'telesales_manage', false,
      'ai_sales_chatbot_view', true, 'ai_sales_leads_view', false,
      'demands_view', true, 'demands_create', true, 'demands_edit', false, 'demands_delete', false, 'demands_settings', false
    );
  -- =============================================
  -- NOVOS PERFIS DE PARCEIROS
  -- =============================================
  ELSIF p_role = 'partner_affiliate' THEN
    -- Afiliado: vê carrinhos/vendas que participa + carteira
    result := jsonb_build_object(
      'leads_view', false, 'leads_view_only_own', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false, 'leads_hide_new_button', true,
      'sales_view', true, 'sales_view_only_own', true, 'sales_create', false, 'sales_edit', false, 'sales_delete', false,
      'products_view', false, 'products_create', false, 'products_edit', false, 'products_delete', false,
      'team_view', false, 'team_create', false, 'team_edit', false, 'team_edit_member', false, 'team_delete', false,
      'settings_view', false, 'settings_edit', false,
      'whatsapp_view', false, 'whatsapp_manage', false, 'whatsapp_ai_settings_view', false, 'whatsapp_ai_settings_edit', false,
      'instagram_view', false, 'instagram_manage', false,
      'post_sale_view', false, 'post_sale_create', false, 'post_sale_edit', false,
      'sac_view', false, 'sac_create', false, 'sac_edit', false,
      'dashboard_view', false, 'dashboard_kanban_view', false,
      'fiscal_view', false, 'fiscal_create', false, 'fiscal_edit', false,
      'financial_view', false, 'financial_edit', false,
      'expedition_view', false, 'expedition_create', false, 'expedition_edit', false, 'expedition_delete', false,
      'reports_view', false,
      'integrations_view', false, 'integrations_edit', false,
      'commissions_view', false, 'commissions_edit', false,
      'helper_donna_view', false,
      'ecommerce_view', true, 'ecommerce_manage', false, 'storefronts_manage', false, 'landing_pages_manage', false,
      'affiliates_view', false, 'affiliates_manage', false, 'payment_gateways_manage', false, 'virtual_wallet_view', true,
      'telesales_view', false, 'telesales_manage', false,
      'ai_sales_chatbot_view', false, 'ai_sales_leads_view', false,
      'demands_view', false, 'demands_create', false, 'demands_edit', false, 'demands_delete', false, 'demands_settings', false
    );
  ELSIF p_role = 'partner_coproducer' THEN
    -- Co-produtor: vê carrinhos/vendas que participa + carteira
    result := jsonb_build_object(
      'leads_view', false, 'leads_view_only_own', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false, 'leads_hide_new_button', true,
      'sales_view', true, 'sales_view_only_own', true, 'sales_create', false, 'sales_edit', false, 'sales_delete', false,
      'products_view', false, 'products_create', false, 'products_edit', false, 'products_delete', false,
      'team_view', false, 'team_create', false, 'team_edit', false, 'team_edit_member', false, 'team_delete', false,
      'settings_view', false, 'settings_edit', false,
      'whatsapp_view', false, 'whatsapp_manage', false, 'whatsapp_ai_settings_view', false, 'whatsapp_ai_settings_edit', false,
      'instagram_view', false, 'instagram_manage', false,
      'post_sale_view', false, 'post_sale_create', false, 'post_sale_edit', false,
      'sac_view', false, 'sac_create', false, 'sac_edit', false,
      'dashboard_view', false, 'dashboard_kanban_view', false,
      'fiscal_view', false, 'fiscal_create', false, 'fiscal_edit', false,
      'financial_view', false, 'financial_edit', false,
      'expedition_view', false, 'expedition_create', false, 'expedition_edit', false, 'expedition_delete', false,
      'reports_view', false,
      'integrations_view', false, 'integrations_edit', false,
      'commissions_view', false, 'commissions_edit', false,
      'helper_donna_view', false,
      'ecommerce_view', true, 'ecommerce_manage', false, 'storefronts_manage', false, 'landing_pages_manage', false,
      'affiliates_view', false, 'affiliates_manage', false, 'payment_gateways_manage', false, 'virtual_wallet_view', true,
      'telesales_view', false, 'telesales_manage', false,
      'ai_sales_chatbot_view', false, 'ai_sales_leads_view', false,
      'demands_view', false, 'demands_create', false, 'demands_edit', false, 'demands_delete', false, 'demands_settings', false
    );
  ELSIF p_role = 'partner_industry' THEN
    -- Indústria: vê vendas que participa + carteira (foco em produção)
    result := jsonb_build_object(
      'leads_view', false, 'leads_view_only_own', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false, 'leads_hide_new_button', true,
      'sales_view', true, 'sales_view_only_own', true, 'sales_create', false, 'sales_edit', false, 'sales_delete', false,
      'products_view', false, 'products_create', false, 'products_edit', false, 'products_delete', false,
      'team_view', false, 'team_create', false, 'team_edit', false, 'team_edit_member', false, 'team_delete', false,
      'settings_view', false, 'settings_edit', false,
      'whatsapp_view', false, 'whatsapp_manage', false, 'whatsapp_ai_settings_view', false, 'whatsapp_ai_settings_edit', false,
      'instagram_view', false, 'instagram_manage', false,
      'post_sale_view', false, 'post_sale_create', false, 'post_sale_edit', false,
      'sac_view', false, 'sac_create', false, 'sac_edit', false,
      'dashboard_view', false, 'dashboard_kanban_view', false,
      'fiscal_view', false, 'fiscal_create', false, 'fiscal_edit', false,
      'financial_view', false, 'financial_edit', false,
      'expedition_view', false, 'expedition_create', false, 'expedition_edit', false, 'expedition_delete', false,
      'reports_view', false,
      'integrations_view', false, 'integrations_edit', false,
      'commissions_view', false, 'commissions_edit', false,
      'helper_donna_view', false,
      'ecommerce_view', true, 'ecommerce_manage', false, 'storefronts_manage', false, 'landing_pages_manage', false,
      'affiliates_view', false, 'affiliates_manage', false, 'payment_gateways_manage', false, 'virtual_wallet_view', true,
      'telesales_view', false, 'telesales_manage', false,
      'ai_sales_chatbot_view', false, 'ai_sales_leads_view', false,
      'demands_view', false, 'demands_create', false, 'demands_edit', false, 'demands_delete', false, 'demands_settings', false
    );
  ELSIF p_role = 'partner_factory' THEN
    -- Fábrica: vê vendas que participa + carteira (foco em produção)
    result := jsonb_build_object(
      'leads_view', false, 'leads_view_only_own', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false, 'leads_hide_new_button', true,
      'sales_view', true, 'sales_view_only_own', true, 'sales_create', false, 'sales_edit', false, 'sales_delete', false,
      'products_view', false, 'products_create', false, 'products_edit', false, 'products_delete', false,
      'team_view', false, 'team_create', false, 'team_edit', false, 'team_edit_member', false, 'team_delete', false,
      'settings_view', false, 'settings_edit', false,
      'whatsapp_view', false, 'whatsapp_manage', false, 'whatsapp_ai_settings_view', false, 'whatsapp_ai_settings_edit', false,
      'instagram_view', false, 'instagram_manage', false,
      'post_sale_view', false, 'post_sale_create', false, 'post_sale_edit', false,
      'sac_view', false, 'sac_create', false, 'sac_edit', false,
      'dashboard_view', false, 'dashboard_kanban_view', false,
      'fiscal_view', false, 'fiscal_create', false, 'fiscal_edit', false,
      'financial_view', false, 'financial_edit', false,
      'expedition_view', false, 'expedition_create', false, 'expedition_edit', false, 'expedition_delete', false,
      'reports_view', false,
      'integrations_view', false, 'integrations_edit', false,
      'commissions_view', false, 'commissions_edit', false,
      'helper_donna_view', false,
      'ecommerce_view', true, 'ecommerce_manage', false, 'storefronts_manage', false, 'landing_pages_manage', false,
      'affiliates_view', false, 'affiliates_manage', false, 'payment_gateways_manage', false, 'virtual_wallet_view', true,
      'telesales_view', false, 'telesales_manage', false,
      'ai_sales_chatbot_view', false, 'ai_sales_leads_view', false,
      'demands_view', false, 'demands_create', false, 'demands_edit', false, 'demands_delete', false, 'demands_settings', false
    );
  ELSE
    -- Default minimal permissions
    result := jsonb_build_object(
      'leads_view', true, 'leads_view_only_own', true, 'leads_create', true, 'leads_edit', false, 'leads_delete', false, 'leads_hide_new_button', false,
      'sales_view', true, 'sales_view_only_own', true, 'sales_create', false, 'sales_edit', false, 'sales_delete', false,
      'products_view', false, 'products_create', false, 'products_edit', false, 'products_delete', false,
      'team_view', false, 'team_create', false, 'team_edit', false, 'team_edit_member', false, 'team_delete', false,
      'settings_view', false, 'settings_edit', false,
      'whatsapp_view', false, 'whatsapp_manage', false, 'whatsapp_ai_settings_view', false, 'whatsapp_ai_settings_edit', false,
      'instagram_view', false, 'instagram_manage', false,
      'post_sale_view', false, 'post_sale_create', false, 'post_sale_edit', false,
      'sac_view', false, 'sac_create', false, 'sac_edit', false,
      'dashboard_view', false, 'dashboard_kanban_view', false,
      'fiscal_view', false, 'fiscal_create', false, 'fiscal_edit', false,
      'financial_view', false, 'financial_edit', false,
      'expedition_view', false, 'expedition_create', false, 'expedition_edit', false, 'expedition_delete', false,
      'reports_view', false,
      'integrations_view', false, 'integrations_edit', false,
      'commissions_view', false, 'commissions_edit', false,
      'helper_donna_view', false,
      'ecommerce_view', false, 'ecommerce_manage', false, 'storefronts_manage', false, 'landing_pages_manage', false,
      'affiliates_view', false, 'affiliates_manage', false, 'payment_gateways_manage', false, 'virtual_wallet_view', false,
      'telesales_view', false, 'telesales_manage', false,
      'ai_sales_chatbot_view', false, 'ai_sales_leads_view', false,
      'demands_view', false, 'demands_create', false, 'demands_edit', false, 'demands_delete', false, 'demands_settings', false
    );
  END IF;
  
  RETURN result;
END;
$$;

-- Função helper para mapear partner_type para role
CREATE OR REPLACE FUNCTION public.get_partner_role(p_partner_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_partner_type
    WHEN 'affiliate' THEN RETURN 'partner_affiliate';
    WHEN 'coproducer' THEN RETURN 'partner_coproducer';
    WHEN 'industry' THEN RETURN 'partner_industry';
    WHEN 'factory' THEN RETURN 'partner_factory';
    ELSE RETURN 'member';
  END CASE;
END;
$$;

-- Atualizar função de aceite para criar organization_member com role correto
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
  
  -- Atualizar profile
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
  
  -- Aplicar permissões em blocos (para evitar limite de argumentos)
  -- Bloco 1: Leads e Sales
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
    sales_create = COALESCE((v_default_perms->>'sales_create')::boolean, false),
    sales_edit = COALESCE((v_default_perms->>'sales_edit')::boolean, false),
    sales_delete = COALESCE((v_default_perms->>'sales_delete')::boolean, false)
  WHERE user_id = p_user_id AND organization_id = v_invitation.organization_id;
  
  -- Bloco 2: E-commerce e Wallet
  UPDATE user_permissions
  SET 
    ecommerce_view = COALESCE((v_default_perms->>'ecommerce_view')::boolean, true),
    ecommerce_manage = COALESCE((v_default_perms->>'ecommerce_manage')::boolean, false),
    storefronts_manage = COALESCE((v_default_perms->>'storefronts_manage')::boolean, false),
    landing_pages_manage = COALESCE((v_default_perms->>'landing_pages_manage')::boolean, false),
    affiliates_view = COALESCE((v_default_perms->>'affiliates_view')::boolean, false),
    affiliates_manage = COALESCE((v_default_perms->>'affiliates_manage')::boolean, false),
    payment_gateways_manage = COALESCE((v_default_perms->>'payment_gateways_manage')::boolean, false),
    virtual_wallet_view = COALESCE((v_default_perms->>'virtual_wallet_view')::boolean, true)
  WHERE user_id = p_user_id AND organization_id = v_invitation.organization_id;
  
  -- Bloco 3: Demais permissões (todas false para parceiros)
  UPDATE user_permissions
  SET 
    products_view = false, products_create = false, products_edit = false, products_delete = false,
    team_view = false, team_create = false, team_edit = false, team_edit_member = false, team_delete = false,
    settings_view = false, settings_edit = false,
    whatsapp_view = false, whatsapp_manage = false, whatsapp_ai_settings_view = false, whatsapp_ai_settings_edit = false,
    instagram_view = false, instagram_manage = false,
    post_sale_view = false, post_sale_create = false, post_sale_edit = false,
    sac_view = false, sac_create = false, sac_edit = false,
    dashboard_view = false, dashboard_kanban_view = false,
    fiscal_view = false, fiscal_create = false, fiscal_edit = false,
    financial_view = false, financial_edit = false,
    expedition_view = false, expedition_create = false, expedition_edit = false, expedition_delete = false,
    reports_view = false,
    integrations_view = false, integrations_edit = false,
    commissions_view = false, commissions_edit = false,
    helper_donna_view = false,
    telesales_view = false, telesales_manage = false,
    ai_sales_chatbot_view = false, ai_sales_leads_view = false,
    demands_view = false, demands_create = false, demands_edit = false, demands_delete = false, demands_settings = false
  WHERE user_id = p_user_id AND organization_id = v_invitation.organization_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'affiliate_code', v_affiliate_code,
    'partner_association_id', v_partner_association_id,
    'partner_role', v_partner_role
  );
END;
$$;

-- Também atualizar approve_partner_application para aplicar permissões
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
  v_partner_role TEXT;
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
    'needs_user_creation', v_user_id IS NULL,
    'partner_role', v_partner_role
  );
END;
$$;