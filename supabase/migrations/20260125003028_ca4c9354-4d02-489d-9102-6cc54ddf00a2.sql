-- Adicionar políticas RLS para Super Admin gerenciar tenant_payment_fees
-- A função has_admin_role já existe e verifica se o usuário é admin

-- Policy para INSERT - Admins podem criar taxas para qualquer tenant
CREATE POLICY "Admins can insert tenant payment fees"
ON public.tenant_payment_fees
FOR INSERT
WITH CHECK (public.has_admin_role(auth.uid()));

-- Policy para UPDATE - Admins podem atualizar taxas de qualquer tenant
CREATE POLICY "Admins can update tenant payment fees"
ON public.tenant_payment_fees
FOR UPDATE
USING (public.has_admin_role(auth.uid()));

-- Policy para DELETE - Admins podem deletar taxas
CREATE POLICY "Admins can delete tenant payment fees"
ON public.tenant_payment_fees
FOR DELETE
USING (public.has_admin_role(auth.uid()));

-- Policy para SELECT - Admins podem ver todas as taxas
CREATE POLICY "Admins can view all tenant payment fees"
ON public.tenant_payment_fees
FOR SELECT
USING (public.has_admin_role(auth.uid()));