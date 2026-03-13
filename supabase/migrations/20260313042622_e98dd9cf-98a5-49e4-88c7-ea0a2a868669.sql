-- Allow coproducers to view order items for orders they have access to
CREATE POLICY "Coproducer can view order items"
ON public.ecommerce_order_items
FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT eo.id FROM ecommerce_orders eo
    WHERE user_is_coproducer_for_order(auth.uid(), eo.id)
  )
);