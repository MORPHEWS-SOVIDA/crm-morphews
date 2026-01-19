-- Add new permission columns to user_permissions table
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS sales_dashboard_view BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS expedition_view BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS integrations_view BOOLEAN NOT NULL DEFAULT false;