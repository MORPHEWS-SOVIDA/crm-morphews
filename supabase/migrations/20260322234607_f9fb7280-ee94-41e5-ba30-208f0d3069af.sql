-- Fix Balestrero storefront: set default seller to Balestrero Tiago
UPDATE tenant_storefronts 
SET default_seller_user_id = 'cadd44e1-b3dd-4433-9750-4e3a62ec1a4b',
    settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{post_sale_funnel_stage_id}', '"029e8de5-6866-4870-a344-42d7f2d67121"')
WHERE slug = 'balestrero';

-- Fix existing sales: change seller to Balestrero Tiago
UPDATE sales 
SET seller_user_id = 'cadd44e1-b3dd-4433-9750-4e3a62ec1a4b'
WHERE id IN ('9c53f4d4-686b-405e-8d8d-d5e823cda07e', 'b04bcadd-52fb-46af-a95a-61bfd6b139a8');

-- Fix Lucas lead: move to VENDA BALESTRERO stage
UPDATE leads 
SET funnel_stage_id = '029e8de5-6866-4870-a344-42d7f2d67121'
WHERE id = '02e6a60c-691f-4656-906d-cc506d4ae015';