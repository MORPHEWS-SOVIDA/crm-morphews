
UPDATE public.profiles
SET partner_virtual_account_id = 'c7720c40-7542-44ca-9c3a-ccb46131c680'
WHERE user_id = '3d379563-01f0-47de-867c-0168e0efb7ae'
  AND partner_virtual_account_id IS NULL;
