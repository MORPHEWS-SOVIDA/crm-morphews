-- Add anticipation fee percentage for payment methods with anticipation flow
ALTER TABLE public.payment_methods 
ADD COLUMN anticipation_fee_percentage numeric DEFAULT 0;