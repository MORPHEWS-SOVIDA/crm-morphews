
-- Add interest bearer columns to payment_links
ALTER TABLE public.payment_links 
  ADD COLUMN interest_bearer text NOT NULL DEFAULT 'customer',
  ADD COLUMN max_interest_free_installments integer DEFAULT 12;

-- Add comment for documentation
COMMENT ON COLUMN public.payment_links.interest_bearer IS 'Who pays installment interest: customer or seller';
COMMENT ON COLUMN public.payment_links.max_interest_free_installments IS 'Max installments without interest when seller absorbs (only used when interest_bearer=seller)';
