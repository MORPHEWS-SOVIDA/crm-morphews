
-- Add fallback WhatsApp instance columns to fiscal_auto_send_config
ALTER TABLE public.fiscal_auto_send_config 
  ADD COLUMN IF NOT EXISTS whatsapp_instance_id_2 uuid REFERENCES public.whatsapp_instances(id),
  ADD COLUMN IF NOT EXISTS whatsapp_instance_id_3 uuid REFERENCES public.whatsapp_instances(id);
