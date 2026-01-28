-- Add Super Admin policies for sale_splits and ecommerce_orders

-- 1. Policy for Super Admin to see all sale_splits
CREATE POLICY "Super admin can view all splits" 
ON public.sale_splits 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- 2. Policy for Super Admin to see all ecommerce_orders
CREATE POLICY "Super admin can view all ecommerce orders" 
ON public.ecommerce_orders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);