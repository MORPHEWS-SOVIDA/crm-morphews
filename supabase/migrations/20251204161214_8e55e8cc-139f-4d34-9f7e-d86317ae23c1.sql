-- Allow users to update their own temp password reset records
CREATE POLICY "Users can update their own temp password resets" 
ON public.temp_password_resets 
FOR UPDATE 
USING ((auth.jwt() ->> 'email'::text) = email)
WITH CHECK ((auth.jwt() ->> 'email'::text) = email);