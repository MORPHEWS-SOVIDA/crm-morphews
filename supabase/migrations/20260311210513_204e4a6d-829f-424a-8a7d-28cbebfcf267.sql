-- Add fixed commission support to coproducers table
ALTER TABLE coproducers 
  ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS commission_fixed_1_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_fixed_3_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_fixed_5_cents integer DEFAULT 0;

COMMENT ON COLUMN coproducers.commission_type IS 'percentage or fixed_per_quantity';
COMMENT ON COLUMN coproducers.commission_fixed_1_cents IS 'Fixed commission in cents for 1 unit sale';
COMMENT ON COLUMN coproducers.commission_fixed_3_cents IS 'Fixed commission in cents for 3 units sale';
COMMENT ON COLUMN coproducers.commission_fixed_5_cents IS 'Fixed commission in cents for 5 units sale';