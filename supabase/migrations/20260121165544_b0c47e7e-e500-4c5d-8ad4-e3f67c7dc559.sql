-- Remove the restrictive CHECK constraint that blocks custom fields
ALTER TABLE public.integration_field_mappings 
DROP CONSTRAINT integration_field_mappings_target_field_check;

-- Add a more flexible CHECK that allows:
-- 1. Standard lead fields
-- 2. Address fields (address_*)
-- 3. Sale fields (sale_*)
-- 4. Custom fields (custom_*)
-- 5. SAC fields (sac_*)
ALTER TABLE public.integration_field_mappings
ADD CONSTRAINT integration_field_mappings_target_field_check 
CHECK (
  target_field IN (
    'name', 'email', 'whatsapp', 'cpf', 'instagram', 'specialty', 'observations',
    'address_street', 'address_number', 'address_complement', 'address_neighborhood', 
    'address_city', 'address_state', 'address_cep',
    'sale_product_name', 'sale_product_sku', 'sale_quantity', 'sale_total_cents',
    'sale_payment_method', 'sale_external_id', 'sale_external_url', 
    'sale_observation_1', 'sale_observation_2',
    'sac_category', 'sac_subcategory', 'sac_priority', 'sac_description'
  )
  OR target_field LIKE 'custom_%'
  OR target_field LIKE 'address_%'
  OR target_field LIKE 'sale_%'
  OR target_field LIKE 'sac_%'
);