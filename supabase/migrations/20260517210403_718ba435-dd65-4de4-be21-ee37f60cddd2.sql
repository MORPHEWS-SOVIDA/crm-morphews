CREATE OR REPLACE FUNCTION public.get_old_whatsapp_media_names(p_days int DEFAULT 60, p_limit int DEFAULT 500)
RETURNS TABLE(name text, size_bytes bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT o.name,
         COALESCE((o.metadata->>'size')::bigint, 0) AS size_bytes
  FROM storage.objects o
  WHERE o.bucket_id = 'whatsapp-media'
    AND o.created_at < now() - (p_days || ' days')::interval
  ORDER BY o.created_at ASC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_old_whatsapp_media_names(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_old_whatsapp_media_names(int, int) TO service_role;