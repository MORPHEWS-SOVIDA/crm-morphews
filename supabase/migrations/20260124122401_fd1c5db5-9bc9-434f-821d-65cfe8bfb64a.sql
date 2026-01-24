-- Add correios_service_code column to shipping_carriers
-- This allows linking a carrier to a specific Correios service (PAC, SEDEX, etc.)
ALTER TABLE public.shipping_carriers 
ADD COLUMN correios_service_code text DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.shipping_carriers.correios_service_code IS 'Optional Correios service code (e.g., 03298 for PAC, 03220 for SEDEX) to auto-select when generating labels';