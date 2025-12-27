-- Add payment_method_id to sales table
ALTER TABLE public.sales 
ADD COLUMN payment_method_id UUID REFERENCES public.payment_methods(id),
ADD COLUMN payment_installments INTEGER DEFAULT 1;