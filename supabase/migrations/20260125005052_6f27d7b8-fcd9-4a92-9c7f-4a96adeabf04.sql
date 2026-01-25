-- Permitir que landing_pages sejam criadas sem produto (para clonagem de templates)
ALTER TABLE public.landing_pages ALTER COLUMN product_id DROP NOT NULL;