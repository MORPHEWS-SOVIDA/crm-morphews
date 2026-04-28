UPDATE public.sales 
SET total_cents = 0, 
    subtotal_cents = 0, 
    seller_commission_cents = 0, 
    discount_cents = 0, 
    shipping_cost_cents = 0
WHERE id = 'eb0e5935-6627-41c8-95e9-fc48ddb47aa1';

UPDATE public.sale_items
SET unit_price_cents = 0,
    total_cents = 0,
    commission_cents = 0,
    discount_cents = 0
WHERE sale_id = 'eb0e5935-6627-41c8-95e9-fc48ddb47aa1';