-- Serial label statuses
CREATE TYPE public.serial_label_status AS ENUM (
  'available',    -- etiqueta gerada, ainda não associada
  'in_stock',     -- associada a produto, em estoque
  'assigned',     -- atribuída a uma venda (separação)
  'shipped',      -- despachada
  'delivered',    -- entregue
  'returned'      -- devolvida
);

CREATE TABLE public.product_serial_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  serial_code TEXT NOT NULL,
  status serial_label_status NOT NULL DEFAULT 'available',
  
  -- Associação com produto (quando colado no frasco)
  product_id UUID REFERENCES public.lead_products(id) ON DELETE SET NULL,
  product_name TEXT,
  
  -- Associação com venda (quando expedido)
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  sale_item_id UUID,
  
  -- Rastreabilidade
  stocked_at TIMESTAMPTZ,
  stocked_by UUID,
  assigned_at TIMESTAMPTZ,
  assigned_by UUID,
  shipped_at TIMESTAMPTZ,
  shipped_by UUID,
  returned_at TIMESTAMPTZ,
  returned_by UUID,
  return_reason TEXT,
  
  -- Lote de geração
  batch_label TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_serial_per_org UNIQUE (organization_id, serial_code)
);

-- Índices para busca rápida
CREATE INDEX idx_serial_labels_serial_code ON public.product_serial_labels(serial_code);
CREATE INDEX idx_serial_labels_status ON public.product_serial_labels(organization_id, status);
CREATE INDEX idx_serial_labels_product ON public.product_serial_labels(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_serial_labels_sale ON public.product_serial_labels(sale_id) WHERE sale_id IS NOT NULL;

-- RLS
ALTER TABLE public.product_serial_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view serial labels of their org"
  ON public.product_serial_labels FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert serial labels for their org"
  ON public.product_serial_labels FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update serial labels of their org"
  ON public.product_serial_labels FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
