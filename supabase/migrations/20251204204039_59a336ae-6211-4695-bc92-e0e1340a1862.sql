-- Add address fields and secondary phone to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS cep text,
ADD COLUMN IF NOT EXISTS street text,
ADD COLUMN IF NOT EXISTS street_number text,
ADD COLUMN IF NOT EXISTS complement text,
ADD COLUMN IF NOT EXISTS neighborhood text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS secondary_phone text;