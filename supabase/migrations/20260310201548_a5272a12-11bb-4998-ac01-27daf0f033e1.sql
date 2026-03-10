-- Fix the paid sale that has 0 items - add the MINDFY product
INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price_cents, total_cents)
VALUES ('3a85c2c7-6f75-4def-833d-effda1d414dc', 'd547df54-3f73-4fa8-ab36-9f166d68304e', 'MINDFY', 1, 25620, 25620);

-- Also fix ecommerce_order_items for the corresponding order
INSERT INTO ecommerce_order_items (order_id, product_id, product_name, quantity, unit_price_cents, total_cents)
VALUES ('5f7cb0b7-7465-402d-97bf-968506cf71df', 'd547df54-3f73-4fa8-ab36-9f166d68304e', 'MINDFY', 1, 25620, 25620);