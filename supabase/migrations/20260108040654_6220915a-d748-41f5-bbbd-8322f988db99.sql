-- =============================================
-- TABELA: Templates de mensagens por motivo de não compra
-- =============================================
CREATE TABLE public.non_purchase_message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  non_purchase_reason_id UUID NOT NULL REFERENCES public.non_purchase_reasons(id) ON DELETE CASCADE,
  whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  message_template TEXT NOT NULL,
  send_start_hour INTEGER DEFAULT NULL,
  send_end_hour INTEGER DEFAULT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.non_purchase_message_templates ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_non_purchase_message_templates_reason ON public.non_purchase_message_templates(non_purchase_reason_id);
CREATE INDEX idx_non_purchase_message_templates_org ON public.non_purchase_message_templates(organization_id);

-- RLS Policies
CREATE POLICY "Users can view message templates from their organization"
ON public.non_purchase_message_templates FOR SELECT
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage message templates"
ON public.non_purchase_message_templates FOR ALL
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Trigger for updated_at
CREATE TRIGGER update_non_purchase_message_templates_updated_at
BEFORE UPDATE ON public.non_purchase_message_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA: Mensagens agendadas por lead
-- =============================================
CREATE TABLE public.lead_scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.non_purchase_message_templates(id) ON DELETE SET NULL,
  whatsapp_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  original_scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  final_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'deleted', 'failed_offline', 'failed_other')),
  failure_reason TEXT,
  cancel_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_lead_scheduled_messages_lead ON public.lead_scheduled_messages(lead_id);
CREATE INDEX idx_lead_scheduled_messages_org ON public.lead_scheduled_messages(organization_id);
CREATE INDEX idx_lead_scheduled_messages_status ON public.lead_scheduled_messages(status);
CREATE INDEX idx_lead_scheduled_messages_scheduled ON public.lead_scheduled_messages(scheduled_at) WHERE status = 'pending';

-- RLS Policies
CREATE POLICY "Users can view scheduled messages from their organization"
ON public.lead_scheduled_messages FOR SELECT
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage scheduled messages from their organization"
ON public.lead_scheduled_messages FOR ALL
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_lead_scheduled_messages_updated_at
BEFORE UPDATE ON public.lead_scheduled_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ADICIONAR PERMISSÃO: scheduled_messages_view
-- =============================================
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS scheduled_messages_view BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS scheduled_messages_manage BOOLEAN NOT NULL DEFAULT false;

-- Atualizar função de permissões padrão para incluir nova permissão
CREATE OR REPLACE FUNCTION public.get_default_permissions_for_role(_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _role = 'owner' OR _role = 'admin' THEN
    RETURN jsonb_build_object(
      'leads_view', true,
      'leads_create', true,
      'leads_edit', true,
      'leads_delete', true,
      'sales_view', true,
      'sales_view_all', true,
      'sales_create', true,
      'sales_edit_draft', true,
      'sales_confirm_payment', true,
      'sales_validate_expedition', true,
      'sales_dispatch', true,
      'sales_mark_delivered', true,
      'sales_cancel', true,
      'whatsapp_view', true,
      'whatsapp_send', true,
      'products_view', true,
      'products_manage', true,
      'products_view_cost', true,
      'settings_view', true,
      'settings_manage', true,
      'settings_funnel_stages', true,
      'settings_delivery_regions', true,
      'settings_carriers', true,
      'settings_payment_methods', true,
      'settings_non_purchase_reasons', true,
      'settings_standard_questions', true,
      'settings_teams', true,
      'settings_lead_sources', true,
      'reports_view', true,
      'deliveries_view_own', true,
      'deliveries_view_all', true,
      'receptive_module_access', true,
      'team_view', true,
      'instagram_view', true,
      'post_sale_view', true,
      'post_sale_manage', true,
      'sac_view', true,
      'sac_manage', true,
      'scheduled_messages_view', true,
      'scheduled_messages_manage', true
    );
  ELSIF _role = 'manager' THEN
    RETURN jsonb_build_object(
      'leads_view', true,
      'leads_create', true,
      'leads_edit', true,
      'leads_delete', false,
      'sales_view', true,
      'sales_view_all', true,
      'sales_create', true,
      'sales_edit_draft', true,
      'sales_confirm_payment', true,
      'sales_validate_expedition', true,
      'sales_dispatch', true,
      'sales_mark_delivered', true,
      'sales_cancel', false,
      'whatsapp_view', true,
      'whatsapp_send', true,
      'products_view', true,
      'products_manage', true,
      'products_view_cost', true,
      'settings_view', true,
      'settings_manage', false,
      'settings_funnel_stages', false,
      'settings_delivery_regions', false,
      'settings_carriers', false,
      'settings_payment_methods', false,
      'settings_non_purchase_reasons', false,
      'settings_standard_questions', false,
      'settings_teams', false,
      'settings_lead_sources', false,
      'reports_view', true,
      'deliveries_view_own', true,
      'deliveries_view_all', true,
      'receptive_module_access', true,
      'team_view', true,
      'instagram_view', false,
      'post_sale_view', true,
      'post_sale_manage', true,
      'sac_view', true,
      'sac_manage', true,
      'scheduled_messages_view', true,
      'scheduled_messages_manage', true
    );
  ELSIF _role = 'seller' THEN
    RETURN jsonb_build_object(
      'leads_view', true,
      'leads_create', true,
      'leads_edit', true,
      'leads_delete', false,
      'sales_view', true,
      'sales_view_all', false,
      'sales_create', true,
      'sales_edit_draft', true,
      'sales_confirm_payment', false,
      'sales_validate_expedition', false,
      'sales_dispatch', false,
      'sales_mark_delivered', false,
      'sales_cancel', false,
      'whatsapp_view', true,
      'whatsapp_send', true,
      'products_view', true,
      'products_manage', false,
      'products_view_cost', false,
      'settings_view', false,
      'settings_manage', false,
      'settings_funnel_stages', false,
      'settings_delivery_regions', false,
      'settings_carriers', false,
      'settings_payment_methods', false,
      'settings_non_purchase_reasons', false,
      'settings_standard_questions', false,
      'settings_teams', false,
      'settings_lead_sources', false,
      'reports_view', false,
      'deliveries_view_own', false,
      'deliveries_view_all', false,
      'receptive_module_access', false,
      'team_view', false,
      'instagram_view', false,
      'post_sale_view', false,
      'post_sale_manage', false,
      'sac_view', false,
      'sac_manage', false,
      'scheduled_messages_view', false,
      'scheduled_messages_manage', false
    );
  ELSE
    RETURN jsonb_build_object(
      'leads_view', true,
      'leads_create', false,
      'leads_edit', false,
      'leads_delete', false,
      'sales_view', false,
      'sales_view_all', false,
      'sales_create', false,
      'sales_edit_draft', false,
      'sales_confirm_payment', false,
      'sales_validate_expedition', false,
      'sales_dispatch', false,
      'sales_mark_delivered', false,
      'sales_cancel', false,
      'whatsapp_view', false,
      'whatsapp_send', false,
      'products_view', true,
      'products_manage', false,
      'products_view_cost', false,
      'settings_view', false,
      'settings_manage', false,
      'settings_funnel_stages', false,
      'settings_delivery_regions', false,
      'settings_carriers', false,
      'settings_payment_methods', false,
      'settings_non_purchase_reasons', false,
      'settings_standard_questions', false,
      'settings_teams', false,
      'settings_lead_sources', false,
      'reports_view', false,
      'deliveries_view_own', false,
      'deliveries_view_all', false,
      'receptive_module_access', false,
      'team_view', false,
      'instagram_view', false,
      'post_sale_view', false,
      'post_sale_manage', false,
      'sac_view', false,
      'sac_manage', false,
      'scheduled_messages_view', false,
      'scheduled_messages_manage', false
    );
  END IF;
END;
$function$;

-- Dar permissão para owners/admins existentes
UPDATE public.user_permissions up
SET scheduled_messages_view = true, scheduled_messages_manage = true
FROM public.organization_members om
WHERE up.user_id = om.user_id 
  AND up.organization_id = om.organization_id
  AND om.role IN ('owner', 'admin');