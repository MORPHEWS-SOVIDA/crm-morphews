-- Drop the restrictive policy
DROP POLICY IF EXISTS "Anyone can insert interested leads" ON public.interested_leads;

-- Create a permissive policy that allows anyone to insert
CREATE POLICY "Anyone can insert interested leads"
ON public.interested_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);