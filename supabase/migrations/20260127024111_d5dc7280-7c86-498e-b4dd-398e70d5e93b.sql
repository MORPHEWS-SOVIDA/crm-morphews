-- =====================================================
-- Sistema de Conferência de Pagamentos em Dinheiro
-- =====================================================

-- Tabela para registrar confirmações de recebimento de dinheiro
CREATE TABLE IF NOT EXISTS public.cash_payment_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    confirmed_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    confirmation_type TEXT NOT NULL CHECK (confirmation_type IN ('receipt', 'handover', 'final_verification')),
    notes TEXT,
    amount_cents INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_cash_confirmations_org ON public.cash_payment_confirmations(organization_id);
CREATE INDEX idx_cash_confirmations_sale ON public.cash_payment_confirmations(sale_id);
CREATE INDEX idx_cash_confirmations_user ON public.cash_payment_confirmations(confirmed_by);
CREATE INDEX idx_cash_confirmations_type ON public.cash_payment_confirmations(confirmation_type);

-- Enable RLS
ALTER TABLE public.cash_payment_confirmations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Members can view cash confirmations for their org"
ON public.cash_payment_confirmations
FOR SELECT
TO authenticated
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Members with permission can insert cash confirmations"
ON public.cash_payment_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_payment_confirmations;

-- =====================================================
-- Adicionar novas permissões na tabela user_permissions
-- =====================================================

-- Permissão para ver botão de conferência de dinheiro
ALTER TABLE public.user_permissions 
    ADD COLUMN IF NOT EXISTS cash_verification_view BOOLEAN NOT NULL DEFAULT false;

-- Permissão para confirmar recebimento de dinheiro
ALTER TABLE public.user_permissions 
    ADD COLUMN IF NOT EXISTS cash_verification_confirm BOOLEAN NOT NULL DEFAULT false;

-- Comments
COMMENT ON COLUMN public.user_permissions.cash_verification_view IS 'Permissão para ver o painel de conferência de pagamentos em dinheiro';
COMMENT ON COLUMN public.user_permissions.cash_verification_confirm IS 'Permissão para confirmar recebimento de dinheiro';

COMMENT ON TABLE public.cash_payment_confirmations IS 'Registro de confirmações de recebimento de pagamentos em dinheiro com histórico de quem confirmou';

-- =====================================================
-- Atualizar função de permissões padrão para incluir novas permissões
-- =====================================================

-- Dar permissões padrão para admins e owners
UPDATE public.user_permissions up
SET 
    cash_verification_view = true,
    cash_verification_confirm = true
FROM public.organization_members om
WHERE up.user_id = om.user_id
  AND up.organization_id = om.organization_id
  AND om.role IN ('owner', 'admin');