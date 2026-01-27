-- Add columns for Industry, Factory, and Coproducer to standalone_checkouts
-- These partners receive a share of EVERY sale from this checkout

ALTER TABLE public.standalone_checkouts
ADD COLUMN IF NOT EXISTS industry_id UUID REFERENCES public.industries(id),
ADD COLUMN IF NOT EXISTS industry_commission_type TEXT DEFAULT 'percentage' CHECK (industry_commission_type IN ('percentage', 'fixed')),
ADD COLUMN IF NOT EXISTS industry_commission_value NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS factory_id UUID REFERENCES public.industries(id),
ADD COLUMN IF NOT EXISTS factory_commission_type TEXT DEFAULT 'fixed' CHECK (factory_commission_type IN ('percentage', 'fixed')),
ADD COLUMN IF NOT EXISTS factory_commission_value NUMERIC DEFAULT 0,

ADD COLUMN IF NOT EXISTS coproducer_id UUID REFERENCES public.virtual_accounts(id),
ADD COLUMN IF NOT EXISTS coproducer_commission_type TEXT DEFAULT 'percentage' CHECK (coproducer_commission_type IN ('percentage', 'fixed')),
ADD COLUMN IF NOT EXISTS coproducer_commission_value NUMERIC DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN public.standalone_checkouts.industry_id IS 'Industry that receives commission on ALL sales from this checkout';
COMMENT ON COLUMN public.standalone_checkouts.factory_id IS 'Factory that receives commission on ALL sales from this checkout';
COMMENT ON COLUMN public.standalone_checkouts.coproducer_id IS 'Coproducer that receives commission on ALL sales from this checkout';