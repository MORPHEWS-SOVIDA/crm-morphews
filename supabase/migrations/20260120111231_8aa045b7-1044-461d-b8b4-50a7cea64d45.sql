-- Add RLS policies for system_settings (only master admin via rpc)
-- For now, we'll allow read/write via service role only (edge functions)

-- Policy: Allow authenticated users to read (will be checked in application layer)
CREATE POLICY "Allow read for authenticated users"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);

-- Policy: No direct writes - will be handled by edge functions with service role
-- This is intentionally restrictive - admin operations go through edge functions