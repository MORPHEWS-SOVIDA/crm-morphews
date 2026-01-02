-- Add tracking code field for shipping carrier sales
ALTER TABLE public.sales
ADD COLUMN tracking_code text;