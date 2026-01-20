-- Renomear wavoip_api_key para wavoip_device_token (mais claro)
-- E adicionar wavoip_status para controle
ALTER TABLE public.whatsapp_instances 
  ADD COLUMN IF NOT EXISTS wavoip_device_token TEXT;

-- Migrar dados existentes de wavoip_api_key para wavoip_device_token
UPDATE public.whatsapp_instances 
SET wavoip_device_token = wavoip_api_key 
WHERE wavoip_api_key IS NOT NULL AND wavoip_device_token IS NULL;