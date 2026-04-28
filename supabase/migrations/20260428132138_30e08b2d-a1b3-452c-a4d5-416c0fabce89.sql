DO $$
DECLARE
  org_ids UUID[] := ARRAY['f581ac35-4d09-4e41-bf22-b204cfa12aae'::uuid, 'a3a616ea-997c-4ec6-a700-df892b0566aa'::uuid];
BEGIN
  -- Tabelas sem CASCADE: limpar manualmente
  DELETE FROM public.ai_provider_failure_logs WHERE organization_id = ANY(org_ids);
  DELETE FROM public.conversation_lead_links WHERE organization_id = ANY(org_ids);
  DELETE FROM public.error_logs WHERE organization_id = ANY(org_ids);
  DELETE FROM public.installment_history WHERE organization_id = ANY(org_ids);
  DELETE FROM public.messaging_daily_metrics WHERE organization_id = ANY(org_ids);
  DELETE FROM public.payment_admin_actions WHERE organization_id = ANY(org_ids);
  DELETE FROM public.payment_attempts WHERE organization_id = ANY(org_ids);
  DELETE FROM public.product_changes_log WHERE organization_id = ANY(org_ids);
  DELETE FROM public.sale_carrier_tracking WHERE organization_id = ANY(org_ids);
  DELETE FROM public.sale_changes_log WHERE organization_id = ANY(org_ids);
  DELETE FROM public.sale_checkpoints WHERE organization_id = ANY(org_ids);
  DELETE FROM public.sale_installments WHERE organization_id = ANY(org_ids);
  DELETE FROM public.sale_payments WHERE organization_id = ANY(org_ids);
  DELETE FROM public.saved_payment_methods WHERE organization_id = ANY(org_ids);
  DELETE FROM public.social_selling_activities WHERE organization_id = ANY(org_ids);
  DELETE FROM public.social_selling_imports WHERE organization_id = ANY(org_ids);
  DELETE FROM public.social_selling_profiles WHERE organization_id = ANY(org_ids);
  DELETE FROM public.social_sellers WHERE organization_id = ANY(org_ids);
  DELETE FROM public.tenant_payment_fees WHERE organization_id = ANY(org_ids);

  -- Por fim, excluir as próprias orgs (CASCADE leva todo o resto)
  DELETE FROM public.organizations WHERE id = ANY(org_ids);
END $$;