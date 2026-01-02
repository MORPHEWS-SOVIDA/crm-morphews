-- Add payment_status column to sales table
-- Options: 'not_paid', 'will_pay_before', 'paid_now'
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'not_paid';

-- Add comment to explain the column
COMMENT ON COLUMN public.sales.payment_status IS 'Payment status at sale creation: not_paid, will_pay_before (requires proof before expedition), paid_now (proof attached at creation)';