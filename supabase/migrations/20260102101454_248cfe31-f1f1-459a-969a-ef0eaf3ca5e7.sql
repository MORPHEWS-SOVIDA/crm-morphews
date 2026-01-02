-- Create a sequence for romaneio numbers starting at 10000
CREATE SEQUENCE IF NOT EXISTS romaneio_number_seq START WITH 10000;

-- Add romaneio_number column to sales table
ALTER TABLE public.sales 
ADD COLUMN romaneio_number INTEGER UNIQUE;

-- Update existing sales with sequential romaneio numbers based on creation order
WITH numbered_sales AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1 AS rn
  FROM public.sales
)
UPDATE public.sales s
SET romaneio_number = 10000 + ns.rn
FROM numbered_sales ns
WHERE s.id = ns.id;

-- Set the sequence to continue after the last used number
SELECT setval('romaneio_number_seq', COALESCE((SELECT MAX(romaneio_number) FROM public.sales), 9999) + 1);

-- Make column not null and set default for future inserts
ALTER TABLE public.sales 
ALTER COLUMN romaneio_number SET DEFAULT nextval('romaneio_number_seq'),
ALTER COLUMN romaneio_number SET NOT NULL;