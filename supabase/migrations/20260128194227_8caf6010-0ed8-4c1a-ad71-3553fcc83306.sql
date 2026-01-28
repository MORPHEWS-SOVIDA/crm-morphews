-- Add shipping configuration to standalone_checkouts
ALTER TABLE public.standalone_checkouts 
ADD COLUMN IF NOT EXISTS shipping_mode text NOT NULL DEFAULT 'none' 
  CHECK (shipping_mode IN ('none', 'free', 'calculated'));

-- Add comment for documentation
COMMENT ON COLUMN public.standalone_checkouts.shipping_mode IS 
  'Shipping mode: none = no shipping, free = free shipping, calculated = calculate via Correios (PAC/SEDEX with R$7 picking + 2 days)';
