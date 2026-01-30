-- Add tablet image column to storefront_banners table
ALTER TABLE public.storefront_banners 
ADD COLUMN IF NOT EXISTS image_tablet_url TEXT;