CREATE OR REPLACE FUNCTION public.clear_group_media_urls()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.whatsapp_messages m
     SET media_url = NULL
   WHERE media_url IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.whatsapp_conversations c
       WHERE c.id = m.conversation_id AND c.is_group = true
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;