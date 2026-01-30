-- URGENTE: Fix RLS policies for anonymous access to lead_products
-- The issue is that the anon role needs explicit table access

-- First, grant SELECT to anon role on lead_products
GRANT SELECT ON public.lead_products TO anon;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Public can view ecommerce-enabled products" ON public.lead_products;

-- Create policy for anonymous users to view ecommerce products
CREATE POLICY "Public can view ecommerce-enabled products"
ON public.lead_products
FOR SELECT
TO anon
USING (
  is_active = true 
  AND ecommerce_enabled = true 
  AND COALESCE(restrict_to_users, false) = false
);