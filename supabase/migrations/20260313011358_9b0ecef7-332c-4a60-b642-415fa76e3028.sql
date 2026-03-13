
DO $$
DECLARE
  v_user_id uuid;
  v_temp_password text := 'ShapEfy2026!';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'eduardo@shapefy.shop';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, 
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      aud, role, confirmation_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'eduardo@shapefy.shop',
      crypt(v_temp_password, gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('first_name', 'Eduardo', 'last_name', 'Shapefy'),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      'authenticated', 'authenticated', ''
    );
    
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      created_at, updated_at, last_sign_in_at
    ) VALUES (
      v_user_id, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'eduardo@shapefy.shop'),
      'email', v_user_id::text,
      now(), now(), now()
    );
  END IF;
  
  -- Profile
  INSERT INTO profiles (user_id, first_name, last_name, whatsapp, email, organization_id)
  VALUES (v_user_id, 'Eduardo', 'Shapefy', '5551999911212', 'eduardo@shapefy.shop', '650b1667-e345-498e-9d41-b963faf824a7')
  ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, whatsapp = EXCLUDED.whatsapp;
  
  -- Role
  INSERT INTO user_roles (user_id, role) VALUES (v_user_id, 'user') ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Link virtual account
  UPDATE virtual_accounts SET user_id = v_user_id WHERE id = '71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2';
  
  -- Partner associations (correct column: linked_product_id)
  INSERT INTO partner_associations (virtual_account_id, organization_id, partner_type, linked_product_id, commission_type, commission_value, is_active)
  VALUES
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', 'd547df54-3f73-4fa8-ab36-9f166d68304e', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', '6bc14d33-7988-4da6-bd24-d588930c5916', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', 'feeada54-ae03-433d-acd7-3506a7e6c4f9', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', '7800cdaf-6277-4239-ac73-bcfe5bd3b932', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', '4541cb8d-b17c-40a8-a0d7-f476a83bc515', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', '38e9d16c-aa38-464d-bfed-183de6995375', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', '49edafac-2921-401b-80b1-599843c57ec2', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', 'c33dc9e2-ecbc-40be-97cb-d9ae63403f44', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', 'a6346f2b-74eb-4829-a88a-b4e2c57cb946', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', '993069b6-9ce7-4e81-b6d0-8950e91138f5', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', '943f51c8-8f60-4ede-8a8b-d58fa9590ed6', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', '9a3d9de1-d567-4f9f-a8bc-7328c6e1516f', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', 'ffeb57fd-89cc-4ac3-a245-0ec3c4cb497f', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', 'e7b5cae7-2ce7-45a6-916f-3635308cf5f7', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', '29117005-9092-40b4-ac3e-2c6378a3f03c', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', '390f8f4c-c9c7-403c-906f-ebf340f68424', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', '2433a96c-75c0-408a-bb48-fc16d1a616c6', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', 'ff8f0ce9-17ee-4a10-b5ee-f8d076f246fd', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', 'b2520c1c-b158-4d74-b9f4-89d133f8977a', 'fixed', 0, true),
    ('71bc4dd2-2c08-4fc6-ac9e-cfe719dd97e2', '650b1667-e345-498e-9d41-b963faf824a7', 'coproducer', '6187713b-f5cd-45e4-9fcc-128528cbc4fa', 'fixed', 0, true)
  ON CONFLICT DO NOTHING;
  
  -- Temp password record
  INSERT INTO temp_password_resets (user_id, email, expires_at)
  VALUES (v_user_id, 'eduardo@shapefy.shop', now() + interval '7 days');
END $$;
