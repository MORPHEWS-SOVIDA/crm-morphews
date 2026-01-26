-- Refatorar get_default_permissions_for_role para usar blocos menores
-- Evita o erro de mais de 100 argumentos do PostgreSQL

CREATE OR REPLACE FUNCTION public.get_default_permissions_for_role(p_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  leads_block JSONB;
  sales_block JSONB;
  products_block JSONB;
  team_block JSONB;
  settings_block JSONB;
  whatsapp_block JSONB;
  instagram_block JSONB;
  postsale_block JSONB;
  sac_block JSONB;
  dashboard_block JSONB;
  fiscal_block JSONB;
  financial_block JSONB;
  expedition_block JSONB;
  reports_block JSONB;
  integrations_block JSONB;
  commissions_block JSONB;
  helper_block JSONB;
  ecommerce_block JSONB;
  telesales_block JSONB;
  ai_block JSONB;
  demands_block JSONB;
BEGIN
  -- Para parceiros, todas as permissões são muito restritas
  IF p_role IN ('partner_affiliate', 'partner_coproducer', 'partner_industry', 'partner_factory') THEN
    leads_block := '{"leads_view": false, "leads_view_only_own": false, "leads_create": false, "leads_edit": false, "leads_delete": false, "leads_hide_new_button": true}'::jsonb;
    sales_block := '{"sales_view": true, "sales_view_only_own": true, "sales_create": false, "sales_edit": false, "sales_delete": false}'::jsonb;
    products_block := '{"products_view": false, "products_create": false, "products_edit": false, "products_delete": false}'::jsonb;
    team_block := '{"team_view": false, "team_create": false, "team_edit": false, "team_edit_member": false, "team_delete": false}'::jsonb;
    settings_block := '{"settings_view": false, "settings_edit": false}'::jsonb;
    whatsapp_block := '{"whatsapp_view": false, "whatsapp_manage": false, "whatsapp_ai_settings_view": false, "whatsapp_ai_settings_edit": false}'::jsonb;
    instagram_block := '{"instagram_view": false, "instagram_manage": false}'::jsonb;
    postsale_block := '{"post_sale_view": false, "post_sale_create": false, "post_sale_edit": false}'::jsonb;
    sac_block := '{"sac_view": false, "sac_create": false, "sac_edit": false}'::jsonb;
    dashboard_block := '{"dashboard_view": false, "dashboard_kanban_view": false}'::jsonb;
    fiscal_block := '{"fiscal_view": false, "fiscal_create": false, "fiscal_edit": false}'::jsonb;
    financial_block := '{"financial_view": false, "financial_edit": false}'::jsonb;
    expedition_block := '{"expedition_view": false, "expedition_create": false, "expedition_edit": false, "expedition_delete": false}'::jsonb;
    reports_block := '{"reports_view": false}'::jsonb;
    integrations_block := '{"integrations_view": false, "integrations_edit": false}'::jsonb;
    commissions_block := '{"commissions_view": false, "commissions_edit": false}'::jsonb;
    helper_block := '{"helper_donna_view": false}'::jsonb;
    ecommerce_block := '{"ecommerce_view": true, "ecommerce_manage": false, "storefronts_manage": false, "landing_pages_manage": false, "affiliates_view": false, "affiliates_manage": false, "payment_gateways_manage": false, "virtual_wallet_view": true}'::jsonb;
    telesales_block := '{"telesales_view": false, "telesales_manage": false}'::jsonb;
    ai_block := '{"ai_sales_chatbot_view": false, "ai_sales_leads_view": false}'::jsonb;
    demands_block := '{"demands_view": false, "demands_create": false, "demands_edit": false, "demands_delete": false, "demands_settings": false}'::jsonb;
    
    result := leads_block || sales_block || products_block || team_block || settings_block ||
              whatsapp_block || instagram_block || postsale_block || sac_block || dashboard_block ||
              fiscal_block || financial_block || expedition_block || reports_block ||
              integrations_block || commissions_block || helper_block || ecommerce_block ||
              telesales_block || ai_block || demands_block;
    RETURN result;
  END IF;
  
  -- Para owner
  IF p_role = 'owner' THEN
    leads_block := '{"leads_view": true, "leads_view_only_own": false, "leads_create": true, "leads_edit": true, "leads_delete": true, "leads_hide_new_button": false}'::jsonb;
    sales_block := '{"sales_view": true, "sales_view_only_own": false, "sales_create": true, "sales_edit": true, "sales_delete": true}'::jsonb;
    products_block := '{"products_view": true, "products_create": true, "products_edit": true, "products_delete": true}'::jsonb;
    team_block := '{"team_view": true, "team_create": true, "team_edit": true, "team_edit_member": true, "team_delete": true}'::jsonb;
    settings_block := '{"settings_view": true, "settings_edit": true}'::jsonb;
    whatsapp_block := '{"whatsapp_view": true, "whatsapp_manage": true, "whatsapp_ai_settings_view": true, "whatsapp_ai_settings_edit": true}'::jsonb;
    instagram_block := '{"instagram_view": true, "instagram_manage": true}'::jsonb;
    postsale_block := '{"post_sale_view": true, "post_sale_create": true, "post_sale_edit": true}'::jsonb;
    sac_block := '{"sac_view": true, "sac_create": true, "sac_edit": true}'::jsonb;
    dashboard_block := '{"dashboard_view": true, "dashboard_kanban_view": true}'::jsonb;
    fiscal_block := '{"fiscal_view": true, "fiscal_create": true, "fiscal_edit": true}'::jsonb;
    financial_block := '{"financial_view": true, "financial_edit": true}'::jsonb;
    expedition_block := '{"expedition_view": true, "expedition_create": true, "expedition_edit": true, "expedition_delete": true}'::jsonb;
    reports_block := '{"reports_view": true}'::jsonb;
    integrations_block := '{"integrations_view": true, "integrations_edit": true}'::jsonb;
    commissions_block := '{"commissions_view": true, "commissions_edit": true}'::jsonb;
    helper_block := '{"helper_donna_view": true}'::jsonb;
    ecommerce_block := '{"ecommerce_view": true, "ecommerce_manage": true, "storefronts_manage": true, "landing_pages_manage": true, "affiliates_view": true, "affiliates_manage": true, "payment_gateways_manage": true, "virtual_wallet_view": true}'::jsonb;
    telesales_block := '{"telesales_view": true, "telesales_manage": true}'::jsonb;
    ai_block := '{"ai_sales_chatbot_view": true, "ai_sales_leads_view": true}'::jsonb;
    demands_block := '{"demands_view": true, "demands_create": true, "demands_edit": true, "demands_delete": true, "demands_settings": true}'::jsonb;
    
    result := leads_block || sales_block || products_block || team_block || settings_block ||
              whatsapp_block || instagram_block || postsale_block || sac_block || dashboard_block ||
              fiscal_block || financial_block || expedition_block || reports_block ||
              integrations_block || commissions_block || helper_block || ecommerce_block ||
              telesales_block || ai_block || demands_block;
    RETURN result;
  END IF;
  
  -- Para admin
  IF p_role = 'admin' THEN
    leads_block := '{"leads_view": true, "leads_view_only_own": false, "leads_create": true, "leads_edit": true, "leads_delete": true, "leads_hide_new_button": false}'::jsonb;
    sales_block := '{"sales_view": true, "sales_view_only_own": false, "sales_create": true, "sales_edit": true, "sales_delete": false}'::jsonb;
    products_block := '{"products_view": true, "products_create": true, "products_edit": true, "products_delete": false}'::jsonb;
    team_block := '{"team_view": true, "team_create": true, "team_edit": true, "team_edit_member": true, "team_delete": false}'::jsonb;
    settings_block := '{"settings_view": true, "settings_edit": true}'::jsonb;
    whatsapp_block := '{"whatsapp_view": true, "whatsapp_manage": true, "whatsapp_ai_settings_view": true, "whatsapp_ai_settings_edit": false}'::jsonb;
    instagram_block := '{"instagram_view": true, "instagram_manage": true}'::jsonb;
    postsale_block := '{"post_sale_view": true, "post_sale_create": true, "post_sale_edit": true}'::jsonb;
    sac_block := '{"sac_view": true, "sac_create": true, "sac_edit": true}'::jsonb;
    dashboard_block := '{"dashboard_view": true, "dashboard_kanban_view": true}'::jsonb;
    fiscal_block := '{"fiscal_view": true, "fiscal_create": true, "fiscal_edit": true}'::jsonb;
    financial_block := '{"financial_view": true, "financial_edit": false}'::jsonb;
    expedition_block := '{"expedition_view": true, "expedition_create": true, "expedition_edit": true, "expedition_delete": false}'::jsonb;
    reports_block := '{"reports_view": true}'::jsonb;
    integrations_block := '{"integrations_view": true, "integrations_edit": true}'::jsonb;
    commissions_block := '{"commissions_view": true, "commissions_edit": false}'::jsonb;
    helper_block := '{"helper_donna_view": true}'::jsonb;
    ecommerce_block := '{"ecommerce_view": true, "ecommerce_manage": true, "storefronts_manage": true, "landing_pages_manage": true, "affiliates_view": true, "affiliates_manage": true, "payment_gateways_manage": false, "virtual_wallet_view": true}'::jsonb;
    telesales_block := '{"telesales_view": true, "telesales_manage": true}'::jsonb;
    ai_block := '{"ai_sales_chatbot_view": true, "ai_sales_leads_view": true}'::jsonb;
    demands_block := '{"demands_view": true, "demands_create": true, "demands_edit": true, "demands_delete": false, "demands_settings": false}'::jsonb;
    
    result := leads_block || sales_block || products_block || team_block || settings_block ||
              whatsapp_block || instagram_block || postsale_block || sac_block || dashboard_block ||
              fiscal_block || financial_block || expedition_block || reports_block ||
              integrations_block || commissions_block || helper_block || ecommerce_block ||
              telesales_block || ai_block || demands_block;
    RETURN result;
  END IF;
  
  -- Para manager
  IF p_role = 'manager' THEN
    leads_block := '{"leads_view": true, "leads_view_only_own": false, "leads_create": true, "leads_edit": true, "leads_delete": false, "leads_hide_new_button": false}'::jsonb;
    sales_block := '{"sales_view": true, "sales_view_only_own": false, "sales_create": true, "sales_edit": true, "sales_delete": false}'::jsonb;
    products_block := '{"products_view": true, "products_create": false, "products_edit": false, "products_delete": false}'::jsonb;
    team_block := '{"team_view": true, "team_create": false, "team_edit": false, "team_edit_member": true, "team_delete": false}'::jsonb;
    settings_block := '{"settings_view": true, "settings_edit": false}'::jsonb;
    whatsapp_block := '{"whatsapp_view": true, "whatsapp_manage": false, "whatsapp_ai_settings_view": false, "whatsapp_ai_settings_edit": false}'::jsonb;
    instagram_block := '{"instagram_view": true, "instagram_manage": false}'::jsonb;
    postsale_block := '{"post_sale_view": true, "post_sale_create": true, "post_sale_edit": true}'::jsonb;
    sac_block := '{"sac_view": true, "sac_create": true, "sac_edit": true}'::jsonb;
    dashboard_block := '{"dashboard_view": true, "dashboard_kanban_view": true}'::jsonb;
    fiscal_block := '{"fiscal_view": false, "fiscal_create": false, "fiscal_edit": false}'::jsonb;
    financial_block := '{"financial_view": false, "financial_edit": false}'::jsonb;
    expedition_block := '{"expedition_view": true, "expedition_create": true, "expedition_edit": true, "expedition_delete": false}'::jsonb;
    reports_block := '{"reports_view": true}'::jsonb;
    integrations_block := '{"integrations_view": false, "integrations_edit": false}'::jsonb;
    commissions_block := '{"commissions_view": true, "commissions_edit": false}'::jsonb;
    helper_block := '{"helper_donna_view": true}'::jsonb;
    ecommerce_block := '{"ecommerce_view": true, "ecommerce_manage": false, "storefronts_manage": false, "landing_pages_manage": false, "affiliates_view": true, "affiliates_manage": false, "payment_gateways_manage": false, "virtual_wallet_view": true}'::jsonb;
    telesales_block := '{"telesales_view": true, "telesales_manage": true}'::jsonb;
    ai_block := '{"ai_sales_chatbot_view": true, "ai_sales_leads_view": true}'::jsonb;
    demands_block := '{"demands_view": true, "demands_create": true, "demands_edit": true, "demands_delete": false, "demands_settings": false}'::jsonb;
    
    result := leads_block || sales_block || products_block || team_block || settings_block ||
              whatsapp_block || instagram_block || postsale_block || sac_block || dashboard_block ||
              fiscal_block || financial_block || expedition_block || reports_block ||
              integrations_block || commissions_block || helper_block || ecommerce_block ||
              telesales_block || ai_block || demands_block;
    RETURN result;
  END IF;
  
  -- Para member
  IF p_role = 'member' THEN
    leads_block := '{"leads_view": true, "leads_view_only_own": true, "leads_create": true, "leads_edit": true, "leads_delete": false, "leads_hide_new_button": false}'::jsonb;
    sales_block := '{"sales_view": true, "sales_view_only_own": true, "sales_create": true, "sales_edit": false, "sales_delete": false}'::jsonb;
    products_block := '{"products_view": true, "products_create": false, "products_edit": false, "products_delete": false}'::jsonb;
    team_block := '{"team_view": false, "team_create": false, "team_edit": false, "team_edit_member": false, "team_delete": false}'::jsonb;
    settings_block := '{"settings_view": false, "settings_edit": false}'::jsonb;
    whatsapp_block := '{"whatsapp_view": true, "whatsapp_manage": false, "whatsapp_ai_settings_view": false, "whatsapp_ai_settings_edit": false}'::jsonb;
    instagram_block := '{"instagram_view": false, "instagram_manage": false}'::jsonb;
    postsale_block := '{"post_sale_view": true, "post_sale_create": true, "post_sale_edit": false}'::jsonb;
    sac_block := '{"sac_view": true, "sac_create": true, "sac_edit": false}'::jsonb;
    dashboard_block := '{"dashboard_view": true, "dashboard_kanban_view": true}'::jsonb;
    fiscal_block := '{"fiscal_view": false, "fiscal_create": false, "fiscal_edit": false}'::jsonb;
    financial_block := '{"financial_view": false, "financial_edit": false}'::jsonb;
    expedition_block := '{"expedition_view": false, "expedition_create": false, "expedition_edit": false, "expedition_delete": false}'::jsonb;
    reports_block := '{"reports_view": false}'::jsonb;
    integrations_block := '{"integrations_view": false, "integrations_edit": false}'::jsonb;
    commissions_block := '{"commissions_view": false, "commissions_edit": false}'::jsonb;
    helper_block := '{"helper_donna_view": true}'::jsonb;
    ecommerce_block := '{"ecommerce_view": false, "ecommerce_manage": false, "storefronts_manage": false, "landing_pages_manage": false, "affiliates_view": false, "affiliates_manage": false, "payment_gateways_manage": false, "virtual_wallet_view": false}'::jsonb;
    telesales_block := '{"telesales_view": true, "telesales_manage": false}'::jsonb;
    ai_block := '{"ai_sales_chatbot_view": true, "ai_sales_leads_view": false}'::jsonb;
    demands_block := '{"demands_view": true, "demands_create": true, "demands_edit": false, "demands_delete": false, "demands_settings": false}'::jsonb;
    
    result := leads_block || sales_block || products_block || team_block || settings_block ||
              whatsapp_block || instagram_block || postsale_block || sac_block || dashboard_block ||
              fiscal_block || financial_block || expedition_block || reports_block ||
              integrations_block || commissions_block || helper_block || ecommerce_block ||
              telesales_block || ai_block || demands_block;
    RETURN result;
  END IF;
  
  -- Default minimal permissions
  leads_block := '{"leads_view": true, "leads_view_only_own": true, "leads_create": true, "leads_edit": false, "leads_delete": false, "leads_hide_new_button": false}'::jsonb;
  sales_block := '{"sales_view": true, "sales_view_only_own": true, "sales_create": false, "sales_edit": false, "sales_delete": false}'::jsonb;
  products_block := '{"products_view": false, "products_create": false, "products_edit": false, "products_delete": false}'::jsonb;
  team_block := '{"team_view": false, "team_create": false, "team_edit": false, "team_edit_member": false, "team_delete": false}'::jsonb;
  settings_block := '{"settings_view": false, "settings_edit": false}'::jsonb;
  whatsapp_block := '{"whatsapp_view": false, "whatsapp_manage": false, "whatsapp_ai_settings_view": false, "whatsapp_ai_settings_edit": false}'::jsonb;
  instagram_block := '{"instagram_view": false, "instagram_manage": false}'::jsonb;
  postsale_block := '{"post_sale_view": false, "post_sale_create": false, "post_sale_edit": false}'::jsonb;
  sac_block := '{"sac_view": false, "sac_create": false, "sac_edit": false}'::jsonb;
  dashboard_block := '{"dashboard_view": false, "dashboard_kanban_view": false}'::jsonb;
  fiscal_block := '{"fiscal_view": false, "fiscal_create": false, "fiscal_edit": false}'::jsonb;
  financial_block := '{"financial_view": false, "financial_edit": false}'::jsonb;
  expedition_block := '{"expedition_view": false, "expedition_create": false, "expedition_edit": false, "expedition_delete": false}'::jsonb;
  reports_block := '{"reports_view": false}'::jsonb;
  integrations_block := '{"integrations_view": false, "integrations_edit": false}'::jsonb;
  commissions_block := '{"commissions_view": false, "commissions_edit": false}'::jsonb;
  helper_block := '{"helper_donna_view": false}'::jsonb;
  ecommerce_block := '{"ecommerce_view": false, "ecommerce_manage": false, "storefronts_manage": false, "landing_pages_manage": false, "affiliates_view": false, "affiliates_manage": false, "payment_gateways_manage": false, "virtual_wallet_view": false}'::jsonb;
  telesales_block := '{"telesales_view": false, "telesales_manage": false}'::jsonb;
  ai_block := '{"ai_sales_chatbot_view": false, "ai_sales_leads_view": false}'::jsonb;
  demands_block := '{"demands_view": false, "demands_create": false, "demands_edit": false, "demands_delete": false, "demands_settings": false}'::jsonb;
  
  result := leads_block || sales_block || products_block || team_block || settings_block ||
            whatsapp_block || instagram_block || postsale_block || sac_block || dashboard_block ||
            fiscal_block || financial_block || expedition_block || reports_block ||
            integrations_block || commissions_block || helper_block || ecommerce_block ||
            telesales_block || ai_block || demands_block;
  RETURN result;
END;
$$;