-- Allow affiliates to read their own checkout links (V2)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'checkout_affiliate_links'
      AND policyname = 'Affiliates can view own checkout links'
  ) THEN
    CREATE POLICY "Affiliates can view own checkout links"
      ON public.checkout_affiliate_links
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.organization_affiliates oa
          WHERE oa.id = checkout_affiliate_links.affiliate_id
            AND oa.user_id = auth.uid()
            AND oa.is_active = true
        )
      );
  END IF;
END
$$;
