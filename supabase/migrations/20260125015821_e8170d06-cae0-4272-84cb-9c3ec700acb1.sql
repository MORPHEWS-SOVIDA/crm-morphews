
-- Add seller assignment and follow-up configuration to automation config
ALTER TABLE public.ecommerce_automation_config
ADD COLUMN IF NOT EXISTS default_seller_id uuid REFERENCES public.profiles(user_id),
ADD COLUMN IF NOT EXISTS cart_recovery_reason_id uuid REFERENCES public.non_purchase_reasons(id),
ADD COLUMN IF NOT EXISTS paid_notification_funnel_stage_id uuid REFERENCES public.organization_funnel_stages(id);

-- Add comments
COMMENT ON COLUMN public.ecommerce_automation_config.default_seller_id IS 'Vendedor padrão para vendas criadas via e-commerce';
COMMENT ON COLUMN public.ecommerce_automation_config.cart_recovery_reason_id IS 'Motivo de não-compra para follow-up de recuperação de carrinho';
COMMENT ON COLUMN public.ecommerce_automation_config.paid_notification_funnel_stage_id IS 'Etapa do funil para notificar quando pagamento é confirmado';
