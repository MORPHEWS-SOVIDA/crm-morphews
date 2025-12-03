-- Allow authenticated users to query their own temp password resets
CREATE POLICY "Users can view their own temp password resets"
ON public.temp_password_resets
FOR SELECT
USING (auth.jwt() ->> 'email' = email);