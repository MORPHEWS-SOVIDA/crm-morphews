
-- Allow anonymous users to read tenant_payment_fees for public checkouts
-- This is necessary because checkout pages need to display correct installment fees
-- without requiring user authentication

CREATE POLICY "Anyone can view tenant payment fees for checkout display"
ON public.tenant_payment_fees
FOR SELECT
USING (true);

-- Drop the restrictive user policy since the new one is more permissive
DROP POLICY IF EXISTS "Users can view their org payment fees" ON public.tenant_payment_fees;
