-- Adicionar novo status de venda para pedidos e-commerce pendentes de pagamento
-- Esses pedidos NÃO aparecem no ERP até serem pagos

ALTER TYPE public.sale_status ADD VALUE IF NOT EXISTS 'ecommerce_pending';