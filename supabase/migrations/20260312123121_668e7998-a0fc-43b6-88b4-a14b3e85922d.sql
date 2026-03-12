UPDATE integrations 
SET 
  default_seller_id = '0ba60901-c711-4f23-86eb-75bbea9c607e',
  default_stage = 'bb0df51f-7041-4946-8c1c-d19be21dc15e',
  default_responsible_user_ids = ARRAY['0ba60901-c711-4f23-86eb-75bbea9c607e']::uuid[]
WHERE id = 'cbbf9067-7b27-4036-b141-663abb18e306';