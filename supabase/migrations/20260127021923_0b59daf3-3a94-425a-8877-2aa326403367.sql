-- Remover política antiga de INSERT
DROP POLICY IF EXISTS "Anyone can create applications" ON public.partner_applications;

-- Criar nova política explicitamente para anon e authenticated
CREATE POLICY "Anyone can create applications"
ON public.partner_applications FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Garantir que a política de SELECT para links públicos também funcione para anon
DROP POLICY IF EXISTS "Anyone can view active public links by slug" ON public.partner_public_links;

CREATE POLICY "Anyone can view active public links by slug"
ON public.partner_public_links FOR SELECT
TO anon, authenticated
USING (is_active = true);