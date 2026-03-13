-- Allow coproducers to see their own sale_splits
CREATE POLICY "Coproducer can view own splits"
ON public.sale_splits
FOR SELECT
TO authenticated
USING (
  virtual_account_id IN (
    SELECT partner_virtual_account_id 
    FROM profiles 
    WHERE user_id = auth.uid() 
    AND partner_virtual_account_id IS NOT NULL
  )
);