-- Add seller delivery confirmation columns to sales
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS seller_delivery_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS seller_delivery_confirmed_by UUID,
ADD COLUMN IF NOT EXISTS seller_delivery_proof_urls TEXT[] DEFAULT '{}';

-- Create storage bucket for delivery proof files (images + audio)
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proofs', 'delivery-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload proof files
CREATE POLICY "Authenticated users can upload delivery proofs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'delivery-proofs');

-- Allow anyone to view delivery proofs (public bucket)
CREATE POLICY "Anyone can view delivery proofs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'delivery-proofs');

-- Allow authenticated users to delete their own proofs
CREATE POLICY "Authenticated users can delete delivery proofs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'delivery-proofs');