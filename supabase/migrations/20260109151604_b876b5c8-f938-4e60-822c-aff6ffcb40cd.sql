ALTER TABLE public.whatsapp_instances
ADD COLUMN IF NOT EXISTS manual_instance_number TEXT,
ADD COLUMN IF NOT EXISTS manual_device_label TEXT;