-- Create RPC function to get admin WhatsApp config
CREATE OR REPLACE FUNCTION public.get_admin_whatsapp_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
BEGIN
  SELECT value INTO v_config
  FROM public.system_settings
  WHERE key = 'admin_whatsapp_instance';
  
  RETURN v_config;
END;
$$;

-- Create RPC function to save admin WhatsApp config (only for master admin)
CREATE OR REPLACE FUNCTION public.save_admin_whatsapp_config(p_config jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_master boolean;
BEGIN
  -- Check if user is master admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_master;
  
  -- Also check email for super admin
  IF NOT v_is_master THEN
    SELECT (auth.jwt() ->> 'email') = 'thiago.morphews@gmail.com' INTO v_is_master;
  END IF;
  
  IF NOT v_is_master THEN
    RAISE EXCEPTION 'Unauthorized: only master admin can modify this setting';
  END IF;
  
  INSERT INTO public.system_settings (key, value, updated_at)
  VALUES ('admin_whatsapp_instance', p_config, now())
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = now();
  
  RETURN true;
END;
$$;