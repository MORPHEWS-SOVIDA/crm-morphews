-- Tabela principal de fechamentos de caixa balcão
CREATE TABLE public.pickup_closings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  closing_number SERIAL,
  closing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Totais
  total_sales INTEGER NOT NULL DEFAULT 0,
  total_amount_cents BIGINT NOT NULL DEFAULT 0,
  total_card_cents BIGINT NOT NULL DEFAULT 0,
  total_pix_cents BIGINT NOT NULL DEFAULT 0,
  total_cash_cents BIGINT NOT NULL DEFAULT 0,
  total_other_cents BIGINT NOT NULL DEFAULT 0,
  
  -- Quem gerou
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Confirmação auxiliar (primeira)
  confirmed_by_auxiliar UUID REFERENCES auth.users(id),
  confirmed_at_auxiliar TIMESTAMP WITH TIME ZONE,
  
  -- Confirmação final (admin/Thiago)
  confirmed_by_admin UUID REFERENCES auth.users(id),
  confirmed_at_admin TIMESTAMP WITH TIME ZONE,
  
  -- Status: pending, confirmed_auxiliar, confirmed_final
  status TEXT NOT NULL DEFAULT 'pending',
  
  notes TEXT,
  
  CONSTRAINT pickup_closings_status_check CHECK (status IN ('pending', 'confirmed_auxiliar', 'confirmed_final'))
);

-- Tabela de vendas incluídas em cada fechamento
CREATE TABLE public.pickup_closing_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closing_id UUID NOT NULL REFERENCES public.pickup_closings(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Snapshot dos dados da venda no momento do fechamento
  sale_number TEXT,
  lead_name TEXT,
  total_cents BIGINT,
  payment_method TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Garantir que uma venda só pode estar em UM fechamento
  CONSTRAINT pickup_closing_sales_unique UNIQUE (sale_id)
);

-- Índices
CREATE INDEX idx_pickup_closings_org ON public.pickup_closings(organization_id);
CREATE INDEX idx_pickup_closings_date ON public.pickup_closings(closing_date);
CREATE INDEX idx_pickup_closings_status ON public.pickup_closings(status);
CREATE INDEX idx_pickup_closing_sales_closing ON public.pickup_closing_sales(closing_id);
CREATE INDEX idx_pickup_closing_sales_sale ON public.pickup_closing_sales(sale_id);

-- RLS
ALTER TABLE public.pickup_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_closing_sales ENABLE ROW LEVEL SECURITY;

-- Políticas para pickup_closings
CREATE POLICY "Users can view pickup closings from their organization"
ON public.pickup_closings FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create pickup closings in their organization"
ON public.pickup_closings FOR INSERT
WITH CHECK (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update pickup closings in their organization"
ON public.pickup_closings FOR UPDATE
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

-- Políticas para pickup_closing_sales
CREATE POLICY "Users can view pickup closing sales from their organization"
ON public.pickup_closing_sales FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create pickup closing sales in their organization"
ON public.pickup_closing_sales FOR INSERT
WITH CHECK (organization_id IN (
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
));