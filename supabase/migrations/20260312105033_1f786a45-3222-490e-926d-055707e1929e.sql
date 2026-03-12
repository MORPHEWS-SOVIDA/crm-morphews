-- Expand coproducers RLS to support products linked through storefronts of the tenant org
-- This fixes add/list operations when storefront products belong to a catalog org.

DROP POLICY IF EXISTS "Tenant gerencia coprodutores" ON public.coproducers;

CREATE POLICY "Tenant gerencia coprodutores"
ON public.coproducers
FOR ALL
TO public
USING (
  (
    product_id IN (
      SELECT lp.id
      FROM public.lead_products lp
      WHERE lp.organization_id IN (
        SELECT p.organization_id
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
      )
    )
  )
  OR
  (
    product_id IN (
      SELECT sp.product_id
      FROM public.storefront_products sp
      JOIN public.tenant_storefronts ts ON ts.id = sp.storefront_id
      WHERE sp.product_id IS NOT NULL
        AND ts.organization_id IN (
          SELECT p.organization_id
          FROM public.profiles p
          WHERE p.user_id = auth.uid()
        )
    )
  )
)
WITH CHECK (
  (
    product_id IN (
      SELECT lp.id
      FROM public.lead_products lp
      WHERE lp.organization_id IN (
        SELECT p.organization_id
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
      )
    )
  )
  OR
  (
    product_id IN (
      SELECT sp.product_id
      FROM public.storefront_products sp
      JOIN public.tenant_storefronts ts ON ts.id = sp.storefront_id
      WHERE sp.product_id IS NOT NULL
        AND ts.organization_id IN (
          SELECT p.organization_id
          FROM public.profiles p
          WHERE p.user_id = auth.uid()
        )
    )
  )
);