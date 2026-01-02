-- Add requisition_number field to sale_items for MANIPULADO products
ALTER TABLE public.sale_items 
ADD COLUMN requisition_number text;