-- Add picking cost and extra days to correios services config
ALTER TABLE public.correios_enabled_services
ADD COLUMN IF NOT EXISTS picking_cost_cents integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_handling_days integer NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.correios_enabled_services.picking_cost_cents IS 'Additional cost per shipment for picking/handling (in cents)';
COMMENT ON COLUMN public.correios_enabled_services.extra_handling_days IS 'Extra business days to add for internal handling/posting time';