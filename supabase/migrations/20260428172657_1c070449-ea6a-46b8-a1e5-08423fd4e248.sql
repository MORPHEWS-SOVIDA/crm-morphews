ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS proof_source TEXT;

COMMENT ON COLUMN public.sales.proof_source IS 'Origem automática do comprovante: webhook_payt, webhook_mercadopago, webhook_shopify, external_system, pos_terminal, manual_upload';

CREATE INDEX IF NOT EXISTS idx_sales_proof_source ON public.sales(proof_source) WHERE proof_source IS NOT NULL;

-- Payt (por external_source ou external_order_url)
UPDATE public.sales
SET proof_source = 'webhook_payt'
WHERE proof_source IS NULL
  AND payment_status = 'confirmed'
  AND (
    external_source ILIKE '%payt%'
    OR external_order_url ILIKE '%payt%'
  );

-- Mercado Pago
UPDATE public.sales
SET proof_source = 'webhook_mercadopago'
WHERE proof_source IS NULL
  AND payment_status = 'confirmed'
  AND (
    external_source ILIKE '%mercado%' OR external_source ILIKE '%mp%'
    OR external_order_url ILIKE '%mercadopago%'
  );

-- Shopify
UPDATE public.sales
SET proof_source = 'webhook_shopify'
WHERE proof_source IS NULL
  AND payment_status = 'confirmed'
  AND external_source ILIKE '%shopify%';

-- POS terminal
UPDATE public.sales
SET proof_source = 'pos_terminal'
WHERE proof_source IS NULL
  AND payment_status = 'confirmed'
  AND pos_transaction_id IS NOT NULL;

-- Sistema externo genérico
UPDATE public.sales
SET proof_source = 'external_system'
WHERE proof_source IS NULL
  AND payment_status = 'confirmed'
  AND external_order_id IS NOT NULL
  AND external_order_id <> '';

-- Manual upload existente
UPDATE public.sales
SET proof_source = 'manual_upload'
WHERE proof_source IS NULL
  AND payment_proof_url IS NOT NULL
  AND payment_proof_url <> '';