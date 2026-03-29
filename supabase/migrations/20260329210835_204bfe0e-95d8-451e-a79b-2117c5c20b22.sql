
DO $$
DECLARE
  v_brand_id uuid := gen_random_uuid();
  v_va_id uuid := gen_random_uuid();
  v_p1 uuid := gen_random_uuid();
  v_p2 uuid := gen_random_uuid();
  v_p3 uuid := gen_random_uuid();
  v_p4 uuid := gen_random_uuid();
  v_p5 uuid := gen_random_uuid();
  v_p6 uuid := gen_random_uuid();
  v_p7 uuid := gen_random_uuid();
  v_p8 uuid := gen_random_uuid();
  v_org uuid := '650b1667-e345-498e-9d41-b963faf824a7';
  v_user uuid := '6fee8f43-5efb-4752-a2ce-a70c8e9e3cd2';
  v_store uuid := '67b027ab-b5a2-44b7-83d6-3018c5bbb64a';
BEGIN
  INSERT INTO product_brands (id, name, organization_id) VALUES (v_brand_id, 'BES', v_org);

  INSERT INTO virtual_accounts (id, organization_id, holder_name, holder_email, account_type, is_active)
  VALUES (v_va_id, v_org, 'Everton Botega', 'everton@besnutrition.com.br', 'coproducer', true);

  INSERT INTO lead_products (id, name, organization_id, brand_id, category, is_active, description, base_price_cents, cost_cents, price_1_unit, price_3_units, price_6_units, how_to_use, unit, ecommerce_enabled, created_by) VALUES
  (v_p1, 'Boost-Up', v_org, v_brand_id, 'manipulado', true, 'Pre-treino completo. Po 600g, 30 doses.', 29800, 10500, 29800, 26820, 17880, '20g pre-treino', 'un', true, v_user),
  (v_p2, 'Force Creatin', v_org, v_brand_id, 'manipulado', true, 'Creatina 3g + Pepstrong 2g. Po 150g, 30 doses.', 34900, 1350, 34900, 31410, 20940, '5g ao dia', 'un', true, v_user),
  (v_p3, 'Sleep Machine', v_org, v_brand_id, 'manipulado', true, 'Formula completa para sono. Po 130g, 30 doses.', 76000, 10450, 76000, 68400, 45600, '1 scoop a noite, sabor limao', 'un', true, v_user),
  (v_p4, 'Daily Energy', v_org, v_brand_id, 'manipulado', true, 'Super greens + imunidade. Po 240g, 30 doses.', 25300, 2650, 25300, 22770, 15180, '1 scoop (8g) ao dia, sabor limao', 'un', true, v_user),
  (v_p5, 'OMG III', v_org, v_brand_id, 'manipulado', true, 'Omega 3 alto em DHA. 60 caps oleosas.', 16500, 6450, 16500, 14850, 9900, '2 capsulas ao dia', 'un', true, v_user),
  (v_p6, 'Max D', v_org, v_brand_id, 'manipulado', true, 'Vit D3 10000UI + A + E + K2. 60 caps.', 9800, 1800, 9800, 8820, 5880, '1 dose ao dia', 'un', true, v_user),
  (v_p7, 'Moun-In', v_org, v_brand_id, 'manipulado', true, 'Magnesio + Creatina + Aminoacidos + Maca. Po 240g.', 21600, 5400, 21600, 19440, 12960, '1 dose ao dia', 'un', true, v_user),
  (v_p8, 'Moun-Out', v_org, v_brand_id, 'manipulado', true, 'Theanina + Mag + Rodiola + 5HTP + Safrin. 120 caps.', 32400, 8100, 32400, 29160, 19440, '4 caps ao dia', 'un', true, v_user);

  INSERT INTO storefront_products (storefront_id, product_id, is_visible, is_featured, display_order) VALUES
  (v_store, v_p1, true, true, 1),
  (v_store, v_p2, true, true, 2),
  (v_store, v_p3, true, true, 3),
  (v_store, v_p4, true, true, 4),
  (v_store, v_p5, true, true, 5),
  (v_store, v_p6, true, true, 6),
  (v_store, v_p7, true, true, 7),
  (v_store, v_p8, true, true, 8);

  INSERT INTO coproducers (virtual_account_id, product_id, commission_type, commission_percentage, is_active) VALUES
  (v_va_id, v_p1, 'percentage', 50, true),
  (v_va_id, v_p2, 'percentage', 50, true),
  (v_va_id, v_p3, 'percentage', 50, true),
  (v_va_id, v_p4, 'percentage', 50, true),
  (v_va_id, v_p5, 'percentage', 50, true),
  (v_va_id, v_p6, 'percentage', 50, true),
  (v_va_id, v_p7, 'percentage', 50, true),
  (v_va_id, v_p8, 'percentage', 50, true);
END $$;
