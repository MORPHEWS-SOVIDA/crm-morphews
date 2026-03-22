DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_combos'
      AND policyname = 'Public can view visible storefront combos'
  ) THEN
    CREATE POLICY "Public can view visible storefront combos"
    ON public.product_combos
    FOR SELECT
    TO anon, authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.storefront_products sp
        JOIN public.tenant_storefronts ts ON ts.id = sp.storefront_id
        WHERE sp.combo_id = product_combos.id
          AND sp.is_visible = true
          AND ts.is_active = true
      )
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_combo_prices'
      AND policyname = 'Public can view visible storefront combo prices'
  ) THEN
    CREATE POLICY "Public can view visible storefront combo prices"
    ON public.product_combo_prices
    FOR SELECT
    TO anon, authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.storefront_products sp
        JOIN public.tenant_storefronts ts ON ts.id = sp.storefront_id
        WHERE sp.combo_id = product_combo_prices.combo_id
          AND sp.is_visible = true
          AND ts.is_active = true
      )
    );
  END IF;
END
$$;