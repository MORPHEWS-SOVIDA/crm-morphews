
-- Create the Balestrero brand
INSERT INTO product_brands (id, name, organization_id)
VALUES ('b0000001-0000-4000-a000-000000000001', 'Balestrero', '2d272c40-22e9-40e2-8cdc-3be142f61717')
ON CONFLICT DO NOTHING;

-- 1. Balestrero POWER
INSERT INTO lead_products (id, name, description, sales_script, price_1_unit, price_3_units, price_6_units, price_12_units, minimum_price, usage_period_days, is_active, is_featured, category, organization_id, brand_id, sku, cost_cents, stock_quantity, minimum_stock, track_stock)
VALUES (
  'aaa20c1c-b158-4aa4-b9f4-8aa133f89001',
  'Balestrero POWER',
  'Energia, foco e resistência para treinar forte e render mais (sem "pico e queda" e sem perder a calma).',
  'O Balestrero POWER é um suplemento em pó criado para quem precisa de gás de verdade no tatame — e fora dele. Composição: Pfaffia 2g, Tribulus 750mg, L-Teanina 200mg, Maca 500mg, Rhodiola 300mg. Sugestão de uso: 1 dose ao dia, 30-45 min antes do treino ou pela manhã.',
  24990, 49980, 74970, 0, 0, 30, true, false, 'manipulado',
  '2d272c40-22e9-40e2-8cdc-3be142f61717',
  'b0000001-0000-4000-a000-000000000001',
  'power-111', 0, 0, 0, false
);

-- 2. CREATINA Jiu-Jitsu
INSERT INTO lead_products (id, name, description, sales_script, price_1_unit, price_3_units, price_6_units, price_12_units, minimum_price, usage_period_days, is_active, is_featured, category, organization_id, brand_id, sku, cost_cents, stock_quantity, minimum_stock, track_stock)
VALUES (
  'aaa20c1c-b158-4aa4-b9f4-8aa133f89002',
  'CREATINA Jiu-Jitsu',
  'Força, explosão e resistência no tatame (energia rápida + foco + gás para manter o ritmo).',
  'Suplemento em pó para combate. Composição: Creatina monohidratada 3.000mg, Taurina 1.000mg, L-Tirosina 750mg, Beterraba em pó 2.000mg, Citrato de sódio 250mg. Sugestão: 1 dose ao dia, pós-treino ou horário fixo.',
  18990, 44970, 64440, 0, 0, 30, true, false, 'manipulado',
  '2d272c40-22e9-40e2-8cdc-3be142f61717',
  'b0000001-0000-4000-a000-000000000001',
  'creatina-111', 0, 0, 0, false
);

-- 3. BOA NOITE
INSERT INTO lead_products (id, name, description, sales_script, price_1_unit, price_3_units, price_6_units, price_12_units, minimum_price, usage_period_days, is_active, is_featured, category, organization_id, brand_id, sku, cost_cents, stock_quantity, minimum_stock, track_stock)
VALUES (
  'aaa20c1c-b158-4aa4-b9f4-8aa133f89003',
  'BOA NOITE',
  'Relaxamento natural para desacelerar a mente e dormir melhor (sono mais leve, sem apagar).',
  'Suplemento com ativos naturais calmantes. Composição: Valeriana 100mg, Mulungu 100mg, Passiflora 90mg, Camomila 100mg, Melissa 150mg. Sugestão: 1 cápsula ao dia, 30-60 min antes de dormir.',
  15990, 29990, 39330, 0, 0, 30, true, false, 'manipulado',
  '2d272c40-22e9-40e2-8cdc-3be142f61717',
  'b0000001-0000-4000-a000-000000000001',
  'noite-111', 0, 0, 0, false
);

-- 4. HEALTH MAN
INSERT INTO lead_products (id, name, description, sales_script, price_1_unit, price_3_units, price_6_units, price_12_units, minimum_price, usage_period_days, is_active, is_featured, category, organization_id, brand_id, sku, cost_cents, stock_quantity, minimum_stock, track_stock)
VALUES (
  'aaa20c1c-b158-4aa4-b9f4-8aa133f89004',
  'HEALTH MAN',
  'Base diária masculina: energia, imunidade e metabolismo em um só protocolo (sem megadoses).',
  'Base diária para homens. Composição: Zinco bisglicinato 15mg, Magnésio bisglicinato 100mg, Vitamina D3 1.000UI, Complexo B completo, Selênio 50mcg, Cromo 35mcg, Licopeno 4mg, Resveratrol 15mg. Sugestão: 2 cápsulas ao dia com refeição.',
  16880, 33760, 65000, 0, 0, 30, true, false, 'manipulado',
  '2d272c40-22e9-40e2-8cdc-3be142f61717',
  'b0000001-0000-4000-a000-000000000001',
  'man-111', 0, 0, 0, false
);

-- 5. BURNFAT
INSERT INTO lead_products (id, name, description, sales_script, price_1_unit, price_3_units, price_6_units, price_12_units, minimum_price, usage_period_days, is_active, is_featured, category, organization_id, brand_id, sku, cost_cents, stock_quantity, minimum_stock, track_stock)
VALUES (
  'aaa20c1c-b158-4aa4-b9f4-8aa133f89005',
  'BURNFAT',
  'Termogênico para mais energia, foco e metabolismo ativo (gás para treinar e acelerar a rotina).',
  'Termogênico para metabolismo e energia. Composição: Cafeína 400mg, Catuaba 120mg, Guaraná 200mg. Sugestão: 2 cápsulas ao dia (1 manhã + 1 pré-treino). Evite à noite.',
  16880, 33760, 65000, 0, 0, 30, true, false, 'manipulado',
  '2d272c40-22e9-40e2-8cdc-3be142f61717',
  'b0000001-0000-4000-a000-000000000001',
  'burn-111', 0, 0, 0, false
);

-- 6. LIBIDO FEMININA
INSERT INTO lead_products (id, name, description, sales_script, price_1_unit, price_3_units, price_6_units, price_12_units, minimum_price, usage_period_days, is_active, is_featured, category, organization_id, brand_id, sku, cost_cents, stock_quantity, minimum_stock, track_stock)
VALUES (
  'aaa20c1c-b158-4aa4-b9f4-8aa133f89006',
  'LIBIDO FEMININA',
  'Suporte natural para desejo, energia e bem-estar íntimo (mais disposição e mais presença no dia a dia).',
  'Suplemento para vitalidade feminina. Composição: Vitamina B6 10mg, Zinco 15mg, Maca 400mg, Canela 50mg. Sugestão: 2 cápsulas ao dia (1 manhã + 1 após almoço).',
  18990, 37980, 56970, 0, 0, 30, true, false, 'manipulado',
  '2d272c40-22e9-40e2-8cdc-3be142f61717',
  'b0000001-0000-4000-a000-000000000001',
  'femini-111', 0, 0, 0, false
);
