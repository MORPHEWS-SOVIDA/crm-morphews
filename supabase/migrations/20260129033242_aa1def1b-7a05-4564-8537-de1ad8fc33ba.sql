
-- Update default values for tenant_payment_fees table
-- These will be applied to all new organizations

ALTER TABLE public.tenant_payment_fees 
  ALTER COLUMN card_enabled SET DEFAULT true,
  ALTER COLUMN card_fee_percentage SET DEFAULT 4.99,
  ALTER COLUMN card_fee_fixed_cents SET DEFAULT 100,
  ALTER COLUMN card_release_days SET DEFAULT 14,
  ALTER COLUMN max_installments SET DEFAULT 12,
  ALTER COLUMN installment_fee_passed_to_buyer SET DEFAULT true,
  ALTER COLUMN installment_fees SET DEFAULT '{"2": 5.26, "3": 7.06, "4": 8.87, "5": 10.7, "6": 12.56, "7": 14.43, "8": 16.32, "9": 18.24, "10": 20.17, "11": 22.12, "12": 24.09}'::jsonb;
