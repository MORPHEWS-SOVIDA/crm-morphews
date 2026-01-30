-- Grant SELECT on storefront_domains to anon for custom domain detection
GRANT SELECT ON public.storefront_domains TO anon;

-- Create policy for anon to read verified domains (verified_at is not null)
DROP POLICY IF EXISTS "Anon can view verified domains" ON public.storefront_domains;
CREATE POLICY "Anon can view verified domains"
ON public.storefront_domains
FOR SELECT
TO anon
USING (verified_at IS NOT NULL);

-- Grant SELECT on tenant_storefronts to anon (should already exist but ensure it)
GRANT SELECT ON public.tenant_storefronts TO anon;

-- Create/update policy for anon to view active storefronts
DROP POLICY IF EXISTS "Anon can view active storefronts" ON public.tenant_storefronts;
CREATE POLICY "Anon can view active storefronts"
ON public.tenant_storefronts
FOR SELECT
TO anon
USING (is_active = true);