-- Expandir tabela lead_products com novos campos para ERP
ALTER TABLE public.lead_products
ADD COLUMN IF NOT EXISTS description VARCHAR(200),
ADD COLUMN IF NOT EXISTS sales_script TEXT,
ADD COLUMN IF NOT EXISTS key_question_1 TEXT,
ADD COLUMN IF NOT EXISTS key_question_2 TEXT,
ADD COLUMN IF NOT EXISTS key_question_3 TEXT,
ADD COLUMN IF NOT EXISTS price_1_unit INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_3_units INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_6_units INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_12_units INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS minimum_price INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS usage_period_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_lead_products_updated_at
BEFORE UPDATE ON public.lead_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Atualizar RLS: somente owners podem gerenciar produtos
DROP POLICY IF EXISTS "Admins can manage lead products" ON public.lead_products;

CREATE POLICY "Owners can manage lead products"
ON public.lead_products
FOR ALL
USING (
  organization_id = get_user_organization_id() 
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = lead_products.organization_id
    AND om.role = 'owner'
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = lead_products.organization_id
    AND om.role = 'owner'
  )
);