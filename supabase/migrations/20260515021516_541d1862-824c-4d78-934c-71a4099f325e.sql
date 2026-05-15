
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS installment_options jsonb;

COMMENT ON COLUMN public.payment_links.installment_options IS
  'Opções fixas de parcelamento por link. Formato: [{"installments":1,"total_cents":49200},{"installments":6,"total_cents":54996},{"installments":12,"total_cents":57360}]. Quando NULL, usa a tabela tenant_payment_fees.';

UPDATE public.tenant_payment_fees
   SET max_transaction_cents = 10000000
 WHERE max_transaction_cents IS NULL OR max_transaction_cents < 10000000;
