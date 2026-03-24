ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS delivery_estimate date NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS last_tracking_update timestamptz NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS last_tracking_status text NULL;

COMMENT ON COLUMN public.sales.delivery_estimate IS 'Previsão de entrega dos Correios';
COMMENT ON COLUMN public.sales.last_tracking_update IS 'Última atualização automática do rastreio';
COMMENT ON COLUMN public.sales.last_tracking_status IS 'Último status retornado pelo rastreio automático';