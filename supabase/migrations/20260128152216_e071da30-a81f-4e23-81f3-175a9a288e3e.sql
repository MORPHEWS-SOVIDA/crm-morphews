-- ============================================================================
-- ADICIONAR PREÇO CUSTOMIZADO AOS CHECKOUTS
-- Permite definir preço diferente do produto base para cada checkout
-- ============================================================================

-- 1. Adicionar campo de preço customizado
ALTER TABLE public.standalone_checkouts
ADD COLUMN IF NOT EXISTS custom_price_cents INTEGER DEFAULT NULL;

-- 2. Adicionar campo de quantidade (para oferecer kits/combos no checkout)
ALTER TABLE public.standalone_checkouts
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- 3. Adicionar campo de nome customizado do produto no checkout
ALTER TABLE public.standalone_checkouts
ADD COLUMN IF NOT EXISTS custom_product_name TEXT DEFAULT NULL;

-- 4. Comentários para documentação
COMMENT ON COLUMN public.standalone_checkouts.custom_price_cents IS 'Preço customizado em centavos. Se NULL, usa o preço do produto.';
COMMENT ON COLUMN public.standalone_checkouts.quantity IS 'Quantidade do produto principal vendido neste checkout.';
COMMENT ON COLUMN public.standalone_checkouts.custom_product_name IS 'Nome customizado para exibir no checkout (ex: Kit 3 Potes).';