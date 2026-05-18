
-- Update sale_items for both the confirmed sale and its draft pair (18/05, Thaysa)
UPDATE public.sale_items
SET quantity = 6,
    unit_price_cents = 7275,
    total_cents = 43652
WHERE id IN ('f65890e3-f9ed-420a-a241-76d9e5ed64e3','3b2e81a2-b024-4a5c-8567-a2c22e276f96');

-- Update sale totals for the confirmed sale
UPDATE public.sales
SET subtotal_cents = 43652,
    total_cents = 43652,
    was_edited = true
WHERE id = 'b3a3b392-497f-4ecf-975b-3ffb6f55cd4a';

-- Update draft as well
UPDATE public.sales
SET subtotal_cents = 43652,
    total_cents = 43652,
    was_edited = true
WHERE id = '676ede37-b52d-4837-a860-4a02eee6baeb';
