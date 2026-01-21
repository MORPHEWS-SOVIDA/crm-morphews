-- Create function for semantic search using pgvector
CREATE OR REPLACE FUNCTION public.match_product_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_organization_id uuid DEFAULT NULL,
  filter_product_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  content_text text,
  content_type text,
  product_id uuid,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pe.content_text,
    pe.content_type,
    pe.product_id,
    1 - (pe.embedding <=> query_embedding) AS similarity,
    pe.metadata
  FROM product_embeddings pe
  WHERE 
    (filter_organization_id IS NULL OR pe.organization_id = filter_organization_id)
    AND (filter_product_ids IS NULL OR pe.product_id = ANY(filter_product_ids))
    AND 1 - (pe.embedding <=> query_embedding) > match_threshold
  ORDER BY pe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;