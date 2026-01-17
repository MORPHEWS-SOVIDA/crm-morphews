-- Adicionar campos na tabela integrations para suportar vendas
ALTER TABLE public.integrations 
ADD COLUMN IF NOT EXISTS event_mode text DEFAULT 'lead' CHECK (event_mode IN ('lead', 'sale', 'both')),
ADD COLUMN IF NOT EXISTS sale_status_on_create text DEFAULT 'rascunho',
ADD COLUMN IF NOT EXISTS sale_tag text DEFAULT 'VENDA ONLINE';

-- Adicionar campo para armazenar o link do sistema de origem na venda
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS external_order_id text,
ADD COLUMN IF NOT EXISTS external_order_url text,
ADD COLUMN IF NOT EXISTS external_source text;

-- Comentários para documentação
COMMENT ON COLUMN public.integrations.event_mode IS 'Tipo de evento: lead, sale, ou both';
COMMENT ON COLUMN public.integrations.sale_status_on_create IS 'Status inicial da venda criada via webhook';
COMMENT ON COLUMN public.integrations.sale_tag IS 'Tag a aplicar em vendas criadas via webhook';
COMMENT ON COLUMN public.sales.external_order_id IS 'ID do pedido no sistema externo';
COMMENT ON COLUMN public.sales.external_order_url IS 'Link para visualizar o pedido no sistema externo';
COMMENT ON COLUMN public.sales.external_source IS 'Nome do sistema de origem (ex: Payt, Hotmart)';