
-- Add missing E-commerce permission columns
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS ecommerce_view boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS ecommerce_manage boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS storefronts_manage boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS landing_pages_manage boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS affiliates_view boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS affiliates_manage boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS payment_gateways_manage boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS virtual_wallet_view boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS telesales_view boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS telesales_manage boolean NOT NULL DEFAULT false;

-- Add missing AI Sales permission columns
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS ai_sales_chatbot_view boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS ai_product_recommendations_view boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS ai_telesales_copilot_view boolean NOT NULL DEFAULT false;

-- Add missing Integrations & Tracking permission columns
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS google_integrations_manage boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS tracking_pixels_manage boolean NOT NULL DEFAULT false;
