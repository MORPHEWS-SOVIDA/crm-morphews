CREATE OR REPLACE FUNCTION public.get_group_whatsapp_media_names(p_limit integer DEFAULT 500)
RETURNS TABLE(name text, size_bytes bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
  WITH groups AS (
    SELECT id::text AS cid FROM public.whatsapp_conversations WHERE is_group = true
  )
  SELECT o.name,
         COALESCE((o.metadata->>'size')::bigint, 0) AS size_bytes
  FROM storage.objects o
  WHERE o.bucket_id = 'whatsapp-media'
    AND EXISTS (SELECT 1 FROM groups g WHERE o.name LIKE '%' || g.cid || '%')
  ORDER BY o.created_at ASC
  LIMIT p_limit;
$$;