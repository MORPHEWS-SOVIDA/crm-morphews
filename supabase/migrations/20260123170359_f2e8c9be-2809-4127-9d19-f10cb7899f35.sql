-- Adicionar policy para permitir leitura de planos ativos para usuários anônimos
-- Isso é necessário para o checkout público funcionar
CREATE POLICY "Anyone can view active plans" 
ON public.subscription_plans 
FOR SELECT 
TO anon
USING (is_active = true);