
-- Update split_type constraint to include coproducer
ALTER TABLE public.sale_splits DROP CONSTRAINT sale_splits_split_type_check;

ALTER TABLE public.sale_splits ADD CONSTRAINT sale_splits_split_type_check 
CHECK (split_type = ANY (ARRAY['tenant'::text, 'platform_fee'::text, 'affiliate'::text, 'industry'::text, 'factory'::text, 'gateway_fee'::text, 'coproducer'::text]));
