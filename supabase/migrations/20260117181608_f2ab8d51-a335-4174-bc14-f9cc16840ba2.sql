-- Add observation fields to sales table for integration data
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS observation_1 TEXT,
ADD COLUMN IF NOT EXISTS observation_2 TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.sales.observation_1 IS 'Observation 1 - used for integration product info from external sources';
COMMENT ON COLUMN public.sales.observation_2 IS 'Observation 2 - used for additional integration product info from external sources';