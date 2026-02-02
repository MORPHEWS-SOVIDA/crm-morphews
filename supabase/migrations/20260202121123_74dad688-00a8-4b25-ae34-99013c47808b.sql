
-- Create storage bucket for white label assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('white-label-assets', 'white-label-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for white label assets bucket
CREATE POLICY "White label owners can upload assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'white-label-assets' 
  AND public.is_white_label_owner(auth.uid())
);

CREATE POLICY "White label owners can update their assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'white-label-assets' 
  AND public.is_white_label_owner(auth.uid())
);

CREATE POLICY "White label owners can delete their assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'white-label-assets' 
  AND public.is_white_label_owner(auth.uid())
);

CREATE POLICY "Anyone can view white label assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'white-label-assets');
