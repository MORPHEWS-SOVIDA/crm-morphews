-- Add Resend API key and welcome notification settings to white_label_configs
ALTER TABLE public.white_label_configs
ADD COLUMN IF NOT EXISTS resend_api_key text,
ADD COLUMN IF NOT EXISTS welcome_whatsapp_instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS send_welcome_via_whatsapp boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS send_welcome_via_email boolean DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.white_label_configs.resend_api_key IS 'Partner Resend API key for sending emails to their customers';
COMMENT ON COLUMN public.white_label_configs.welcome_whatsapp_instance_id IS 'WhatsApp instance to use for sending welcome messages';
COMMENT ON COLUMN public.white_label_configs.send_welcome_via_whatsapp IS 'Whether to send welcome message via WhatsApp';
COMMENT ON COLUMN public.white_label_configs.send_welcome_via_email IS 'Whether to send welcome email via Resend';

-- Add platform setup fee percentage to white_label_plans (12%)
ALTER TABLE public.white_label_plans
ADD COLUMN IF NOT EXISTS platform_setup_fee_percentage numeric DEFAULT 12;

-- Add energy cost settings
ALTER TABLE public.white_label_plans
ADD COLUMN IF NOT EXISTS extra_energy_cost_cents integer DEFAULT 700;

COMMENT ON COLUMN public.white_label_plans.platform_setup_fee_percentage IS 'Percentage of setup fee that goes to platform (default 12%)';
COMMENT ON COLUMN public.white_label_plans.extra_energy_cost_cents IS 'Cost per 1000 extra energy units (default R$ 7.00)';