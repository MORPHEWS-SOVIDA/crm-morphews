-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Add product_scope field to ai_bots to control product selection
ALTER TABLE public.ai_bots 
ADD COLUMN IF NOT EXISTS product_scope TEXT DEFAULT 'all';

-- Add column to track if semantic search is enabled
ALTER TABLE public.ai_bots 
ADD COLUMN IF NOT EXISTS use_rag_search BOOLEAN DEFAULT true;

-- Create a table for product embeddings (for vector search)
CREATE TABLE IF NOT EXISTS public.product_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES lead_products(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding extensions.vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id, content_type, content_hash)
);

-- Enable RLS
ALTER TABLE public.product_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their org embeddings" ON public.product_embeddings
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their org embeddings" ON public.product_embeddings
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_embeddings_org ON public.product_embeddings(organization_id);
CREATE INDEX IF NOT EXISTS idx_product_embeddings_product ON public.product_embeddings(product_id);
CREATE INDEX IF NOT EXISTS idx_product_embeddings_type ON public.product_embeddings(content_type);

-- Create HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_product_embeddings_vector 
ON public.product_embeddings 
USING hnsw (embedding extensions.vector_cosine_ops);

COMMENT ON TABLE public.product_embeddings IS 'Stores vector embeddings of product content for semantic search in AI bots';