
INSERT INTO partner_associations (virtual_account_id, organization_id, partner_type, linked_product_id, commission_type, commission_value, is_active)
VALUES
  ('c7720c40-7542-44ca-9c3a-ccb46131c680', '2d272c40-22e9-40e2-8cdc-3be142f61717', 'coproducer', 'aaa20c1c-b158-4aa4-b9f4-8aa133f89001', 'fixed', 0, true),
  ('c7720c40-7542-44ca-9c3a-ccb46131c680', '2d272c40-22e9-40e2-8cdc-3be142f61717', 'coproducer', 'aaa20c1c-b158-4aa4-b9f4-8aa133f89002', 'fixed', 0, true),
  ('c7720c40-7542-44ca-9c3a-ccb46131c680', '2d272c40-22e9-40e2-8cdc-3be142f61717', 'coproducer', 'aaa20c1c-b158-4aa4-b9f4-8aa133f89003', 'fixed', 0, true),
  ('c7720c40-7542-44ca-9c3a-ccb46131c680', '2d272c40-22e9-40e2-8cdc-3be142f61717', 'coproducer', 'aaa20c1c-b158-4aa4-b9f4-8aa133f89004', 'fixed', 0, true),
  ('c7720c40-7542-44ca-9c3a-ccb46131c680', '2d272c40-22e9-40e2-8cdc-3be142f61717', 'coproducer', 'aaa20c1c-b158-4aa4-b9f4-8aa133f89005', 'fixed', 0, true),
  ('c7720c40-7542-44ca-9c3a-ccb46131c680', '2d272c40-22e9-40e2-8cdc-3be142f61717', 'coproducer', 'aaa20c1c-b158-4aa4-b9f4-8aa133f89006', 'fixed', 0, true)
ON CONFLICT DO NOTHING;
