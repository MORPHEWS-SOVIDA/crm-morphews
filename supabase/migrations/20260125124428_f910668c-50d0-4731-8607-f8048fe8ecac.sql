-- =====================================================
-- CONTROLE DE ESTOQUE AVANÇADO - PADRÃO ERP
-- =====================================================

-- 1. MÚLTIPLOS DEPÓSITOS/LOCAIS DE ESTOQUE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.stock_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock_locations in their org" ON public.stock_locations
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage stock_locations in their org" ON public.stock_locations
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Estoque por localização (estoque descentralizado)
CREATE TABLE IF NOT EXISTS public.stock_by_location (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.stock_locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  average_cost_cents INTEGER, -- Custo médio ponderado neste local
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, location_id)
);

ALTER TABLE public.stock_by_location ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock_by_location in their org" ON public.stock_by_location
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage stock_by_location in their org" ON public.stock_by_location
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_stock_by_location_product ON public.stock_by_location(product_id);
CREATE INDEX idx_stock_by_location_location ON public.stock_by_location(location_id);

-- 2. NOTAS FISCAIS DE ENTRADA (COMPRA/FORNECEDOR)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Dados da NF-e
  access_key TEXT UNIQUE, -- Chave de acesso 44 dígitos
  number TEXT NOT NULL,
  series TEXT,
  issue_date DATE NOT NULL,
  entry_date DATE DEFAULT CURRENT_DATE,
  
  -- Fornecedor
  supplier_cnpj TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_ie TEXT,
  
  -- Valores
  total_products_cents INTEGER NOT NULL DEFAULT 0,
  total_freight_cents INTEGER NOT NULL DEFAULT 0,
  total_discount_cents INTEGER NOT NULL DEFAULT 0,
  total_taxes_cents INTEGER NOT NULL DEFAULT 0,
  total_invoice_cents INTEGER NOT NULL DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, cancelled
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  
  -- XML original
  xml_content TEXT,
  xml_storage_path TEXT,
  
  -- Metadados
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view purchase_invoices in their org" ON public.purchase_invoices
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage purchase_invoices in their org" ON public.purchase_invoices
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_purchase_invoices_org ON public.purchase_invoices(organization_id);
CREATE INDEX idx_purchase_invoices_supplier ON public.purchase_invoices(supplier_cnpj);
CREATE INDEX idx_purchase_invoices_status ON public.purchase_invoices(status);

-- 3. ITENS DA NOTA FISCAL DE ENTRADA
-- =====================================================
CREATE TABLE IF NOT EXISTS public.purchase_invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  
  -- Dados do XML
  item_number INTEGER NOT NULL, -- nItem do XML
  supplier_product_code TEXT, -- cProd do fornecedor
  supplier_product_name TEXT NOT NULL, -- xProd
  ncm TEXT,
  cfop TEXT,
  unit TEXT, -- uCom
  quantity NUMERIC(15,4) NOT NULL,
  unit_price_cents INTEGER NOT NULL, -- vUnCom
  total_price_cents INTEGER NOT NULL, -- vProd
  discount_cents INTEGER DEFAULT 0,
  freight_cents INTEGER DEFAULT 0,
  
  -- Dados do EAN/GTIN
  ean TEXT, -- cEAN ou cEANTrib
  
  -- Impostos
  icms_base_cents INTEGER DEFAULT 0,
  icms_value_cents INTEGER DEFAULT 0,
  icms_st_cents INTEGER DEFAULT 0,
  ipi_cents INTEGER DEFAULT 0,
  pis_cents INTEGER DEFAULT 0,
  cofins_cents INTEGER DEFAULT 0,
  
  -- Vínculo com produto interno
  product_id UUID REFERENCES public.lead_products(id),
  linked_at TIMESTAMPTZ,
  linked_by UUID REFERENCES auth.users(id),
  link_status TEXT DEFAULT 'pending', -- pending, linked, created, skipped
  
  -- Entrada de estoque
  stock_location_id UUID REFERENCES public.stock_locations(id),
  stock_entered BOOLEAN DEFAULT false,
  stock_movement_id UUID REFERENCES public.stock_movements(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view purchase_invoice_items in their org" ON public.purchase_invoice_items
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage purchase_invoice_items in their org" ON public.purchase_invoice_items
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_purchase_invoice_items_invoice ON public.purchase_invoice_items(invoice_id);
CREATE INDEX idx_purchase_invoice_items_product ON public.purchase_invoice_items(product_id);
CREATE INDEX idx_purchase_invoice_items_ean ON public.purchase_invoice_items(ean);

-- 4. CORRELAÇÃO DE PRODUTOS DO FORNECEDOR
-- =====================================================
CREATE TABLE IF NOT EXISTS public.supplier_product_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  supplier_cnpj TEXT NOT NULL,
  supplier_product_code TEXT NOT NULL, -- cProd do fornecedor
  supplier_product_name TEXT, -- xProd para referência
  
  product_id UUID NOT NULL REFERENCES public.lead_products(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(organization_id, supplier_cnpj, supplier_product_code)
);

ALTER TABLE public.supplier_product_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view supplier_product_mappings in their org" ON public.supplier_product_mappings
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage supplier_product_mappings in their org" ON public.supplier_product_mappings
  FOR ALL USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_supplier_mappings_supplier ON public.supplier_product_mappings(supplier_cnpj, supplier_product_code);

-- 5. CONFIGURAÇÃO DE ESTOQUE POR ORGANIZAÇÃO
-- =====================================================
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS stock_allow_negative BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS stock_use_average_cost BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS stock_use_locations BOOLEAN DEFAULT false;

-- 6. CUSTO MÉDIO PONDERADO NO PRODUTO
-- =====================================================
ALTER TABLE public.lead_products
  ADD COLUMN IF NOT EXISTS average_cost_cents INTEGER,
  ADD COLUMN IF NOT EXISTS last_purchase_cost_cents INTEGER,
  ADD COLUMN IF NOT EXISTS last_purchase_date DATE;

-- 7. ADICIONAR LOCALIZAÇÃO AOS MOVIMENTOS DE ESTOQUE
-- =====================================================
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.stock_locations(id),
  ADD COLUMN IF NOT EXISTS cost_cents INTEGER,
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.purchase_invoices(id);

-- 8. FUNÇÃO PARA CALCULAR CUSTO MÉDIO PONDERADO
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_weighted_average_cost(
  p_product_id UUID,
  p_current_quantity INTEGER,
  p_current_avg_cost INTEGER,
  p_new_quantity INTEGER,
  p_new_cost INTEGER
) RETURNS INTEGER AS $$
DECLARE
  total_value BIGINT;
  total_quantity INTEGER;
  new_avg INTEGER;
BEGIN
  -- Se não tinha estoque anterior, retorna o novo custo
  IF p_current_quantity <= 0 THEN
    RETURN p_new_cost;
  END IF;
  
  -- Calcula o valor total atual + valor da nova entrada
  total_value := (p_current_quantity::BIGINT * COALESCE(p_current_avg_cost, 0)) + 
                 (p_new_quantity::BIGINT * p_new_cost);
  total_quantity := p_current_quantity + p_new_quantity;
  
  -- Evita divisão por zero
  IF total_quantity <= 0 THEN
    RETURN p_new_cost;
  END IF;
  
  new_avg := (total_value / total_quantity)::INTEGER;
  RETURN new_avg;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 9. FUNÇÃO PARA PROCESSAR ENTRADA DE ESTOQUE VIA NF
-- =====================================================
CREATE OR REPLACE FUNCTION public.process_purchase_invoice_stock(
  p_invoice_id UUID,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_org_id UUID;
  v_item RECORD;
  v_product RECORD;
  v_new_quantity INTEGER;
  v_new_avg_cost INTEGER;
  v_movement_id UUID;
  v_processed_count INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
BEGIN
  -- Get organization
  SELECT organization_id INTO v_org_id 
  FROM purchase_invoices WHERE id = p_invoice_id;
  
  -- Process each linked item
  FOR v_item IN 
    SELECT * FROM purchase_invoice_items 
    WHERE invoice_id = p_invoice_id 
      AND product_id IS NOT NULL 
      AND stock_entered = false
  LOOP
    BEGIN
      -- Get current product data
      SELECT stock_quantity, average_cost_cents, cost_cents 
      INTO v_product
      FROM lead_products WHERE id = v_item.product_id;
      
      -- Calculate new quantity
      v_new_quantity := COALESCE(v_product.stock_quantity, 0) + v_item.quantity::INTEGER;
      
      -- Calculate new average cost
      v_new_avg_cost := calculate_weighted_average_cost(
        v_item.product_id,
        COALESCE(v_product.stock_quantity, 0),
        COALESCE(v_product.average_cost_cents, v_product.cost_cents, 0),
        v_item.quantity::INTEGER,
        v_item.unit_price_cents
      );
      
      -- Create stock movement
      INSERT INTO stock_movements (
        organization_id, product_id, movement_type, quantity,
        previous_quantity, new_quantity, reference_id, reference_type,
        notes, created_by, location_id, cost_cents, invoice_id
      ) VALUES (
        v_org_id, v_item.product_id, 'entry', v_item.quantity::INTEGER,
        COALESCE(v_product.stock_quantity, 0), v_new_quantity, v_item.id, 'purchase_invoice_item',
        'Entrada via NF ' || (SELECT number FROM purchase_invoices WHERE id = p_invoice_id),
        p_user_id, v_item.stock_location_id, v_item.unit_price_cents, p_invoice_id
      ) RETURNING id INTO v_movement_id;
      
      -- Update product stock and costs
      UPDATE lead_products SET
        stock_quantity = v_new_quantity,
        average_cost_cents = v_new_avg_cost,
        last_purchase_cost_cents = v_item.unit_price_cents,
        last_purchase_date = CURRENT_DATE
      WHERE id = v_item.product_id;
      
      -- Mark item as processed
      UPDATE purchase_invoice_items SET
        stock_entered = true,
        stock_movement_id = v_movement_id
      WHERE id = v_item.id;
      
      v_processed_count := v_processed_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'item_id', v_item.id,
        'product_id', v_item.product_id,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  -- Update invoice status
  UPDATE purchase_invoices SET
    status = 'completed',
    processed_at = now(),
    processed_by = p_user_id
  WHERE id = p_invoice_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'processed_count', v_processed_count,
    'errors', v_errors
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. ÍNDICES ADICIONAIS
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_lead_products_ean ON public.lead_products(barcode_ean) WHERE barcode_ean IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_products_gtin ON public.lead_products(gtin_tax) WHERE gtin_tax IS NOT NULL;