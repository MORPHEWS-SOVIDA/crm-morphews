-- Adicionar políticas RLS para super admins gerenciarem saldo SMS

-- Policy para super admins visualizarem todos os saldos
CREATE POLICY "Super admins can view all SMS balances" 
ON public.sms_credits_balance 
FOR SELECT 
USING (public.is_super_admin(auth.uid()));

-- Policy para super admins inserirem novos saldos
CREATE POLICY "Super admins can insert SMS balances" 
ON public.sms_credits_balance 
FOR INSERT 
WITH CHECK (public.is_super_admin(auth.uid()));

-- Policy para super admins atualizarem saldos
CREATE POLICY "Super admins can update SMS balances" 
ON public.sms_credits_balance 
FOR UPDATE 
USING (public.is_super_admin(auth.uid()));

-- Também adicionar políticas para sms_credits_purchases (histórico de compras)
CREATE POLICY "Super admins can view all SMS purchases" 
ON public.sms_credits_purchases 
FOR SELECT 
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert SMS purchases" 
ON public.sms_credits_purchases 
FOR INSERT 
WITH CHECK (public.is_super_admin(auth.uid()));