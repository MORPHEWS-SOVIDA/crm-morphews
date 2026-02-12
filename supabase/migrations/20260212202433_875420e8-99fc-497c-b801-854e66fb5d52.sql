
-- Add cpf_cnpj to allowed target fields
ALTER TABLE integration_field_mappings DROP CONSTRAINT integration_field_mappings_target_field_check;

ALTER TABLE integration_field_mappings ADD CONSTRAINT integration_field_mappings_target_field_check
CHECK (
  (target_field = ANY (ARRAY['name'::text, 'email'::text, 'whatsapp'::text, 'cpf'::text, 'cpf_cnpj'::text, 'instagram'::text, 'specialty'::text, 'observations'::text, 'address_street'::text, 'address_number'::text, 'address_complement'::text, 'address_neighborhood'::text, 'address_city'::text, 'address_state'::text, 'address_cep'::text, 'sale_product_name'::text, 'sale_product_sku'::text, 'sale_quantity'::text, 'sale_total_cents'::text, 'sale_payment_method'::text, 'sale_installments'::text, 'sale_external_id'::text, 'sale_external_url'::text, 'sale_observation_1'::text, 'sale_observation_2'::text, 'sac_category'::text, 'sac_subcategory'::text, 'sac_priority'::text, 'sac_description'::text]))
  OR (target_field ~~ 'custom_%'::text)
  OR (target_field ~~ 'address_%'::text)
  OR (target_field ~~ 'sale_%'::text)
  OR (target_field ~~ 'sac_%'::text)
);
