-- Add seller_user_id column to sales table
-- This tracks the actual seller who made the sale, which may be different from created_by (who entered the data)
ALTER TABLE public.sales 
ADD COLUMN seller_user_id uuid REFERENCES auth.users(id);

-- Populate existing sales with created_by as the default seller
UPDATE public.sales SET seller_user_id = created_by WHERE seller_user_id IS NULL;