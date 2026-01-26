
-- Tabela para armazenar transações recebidas de fontes externas (PIX, TEF, etc)
-- que ainda não foram associadas a vendas
CREATE TABLE public.incoming_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Fonte da transação
  source TEXT NOT NULL, -- 'efipay', 'pagarme', 'getnet', 'banrisul', 'vero', 'manual'
  source_transaction_id TEXT, -- ID único da transação na fonte (txid, NSU, etc)
  
  -- Dados da transação
  amount_cents INTEGER NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Dados do pagador (quando disponível via API)
  payer_name TEXT,
  payer_document TEXT, -- CPF/CNPJ (mascarado ou completo)
  payer_bank TEXT,
  
  -- Dados extras da API
  end_to_end_id TEXT, -- Para PIX
  raw_payload JSONB,
  
  -- Status de conciliação
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'matched', 'ignored'
  matched_sale_id UUID REFERENCES public.sales(id),
  matched_at TIMESTAMPTZ,
  matched_by UUID REFERENCES auth.users(id),
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Índices para busca rápida
  CONSTRAINT unique_source_transaction UNIQUE (organization_id, source, source_transaction_id)
);

-- Índices para performance
CREATE INDEX idx_incoming_transactions_org_status ON public.incoming_transactions(organization_id, status);
CREATE INDEX idx_incoming_transactions_source ON public.incoming_transactions(source);
CREATE INDEX idx_incoming_transactions_amount ON public.incoming_transactions(amount_cents);
CREATE INDEX idx_incoming_transactions_date ON public.incoming_transactions(transaction_date DESC);

-- RLS
ALTER TABLE public.incoming_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's transactions"
  ON public.incoming_transactions FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their organization's transactions"
  ON public.incoming_transactions FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Trigger para updated_at
CREATE TRIGGER update_incoming_transactions_updated_at
  BEFORE UPDATE ON public.incoming_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de configuração de fontes de pagamento por organização
CREATE TABLE public.payment_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  source TEXT NOT NULL, -- 'efipay', 'getnet', 'banrisul', 'vero'
  display_name TEXT NOT NULL, -- 'EfiPay PIX', 'Getnet TEF', etc
  
  -- Credenciais (criptografadas)
  credentials_encrypted JSONB,
  
  -- Configuração
  is_active BOOLEAN DEFAULT true,
  webhook_secret TEXT, -- Para validar webhooks
  pix_key TEXT, -- Chave PIX (para EfiPay)
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_org_source UNIQUE (organization_id, source)
);

-- RLS
ALTER TABLE public.payment_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payment sources"
  ON public.payment_sources FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Função para associar transação a uma venda
CREATE OR REPLACE FUNCTION public.match_transaction_to_sale(
  p_transaction_id UUID,
  p_sale_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_transaction RECORD;
  v_sale RECORD;
BEGIN
  -- Buscar transação
  SELECT * INTO v_transaction 
  FROM public.incoming_transactions 
  WHERE id = p_transaction_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Transação não encontrada ou já associada');
  END IF;
  
  -- Buscar venda
  SELECT * INTO v_sale 
  FROM public.sales 
  WHERE id = p_sale_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Venda não encontrada');
  END IF;
  
  -- Atualizar transação
  UPDATE public.incoming_transactions
  SET 
    status = 'matched',
    matched_sale_id = p_sale_id,
    matched_at = now(),
    matched_by = p_user_id
  WHERE id = p_transaction_id;
  
  -- Atualizar venda para pago
  UPDATE public.sales
  SET 
    status = 'paid',
    payment_status = 'paid',
    payment_confirmed_at = v_transaction.transaction_date,
    updated_at = now()
  WHERE id = p_sale_id;
  
  -- Atualizar parcelas se existirem
  UPDATE public.sale_installments
  SET 
    status = 'paid',
    paid_at = v_transaction.transaction_date,
    paid_amount_cents = amount_cents
  WHERE sale_id = p_sale_id AND status = 'pending';
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Transação associada com sucesso',
    'transaction_amount', v_transaction.amount_cents,
    'sale_total', v_sale.total_amount_cents
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
