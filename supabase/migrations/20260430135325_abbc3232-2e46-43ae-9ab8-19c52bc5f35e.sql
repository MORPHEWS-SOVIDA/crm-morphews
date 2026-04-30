-- ENTREGA 2: Bucket de anexos financeiros + RLS
INSERT INTO storage.buckets (id, name, public)
VALUES ('financial-attachments', 'financial-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: somente quem tem acesso financeiro à org pode ler/gravar
-- Path convention: {organization_id}/{transaction_id}/{filename}
DROP POLICY IF EXISTS "fin_attach_select" ON storage.objects;
CREATE POLICY "fin_attach_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'financial-attachments'
  AND public.has_financial_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);

DROP POLICY IF EXISTS "fin_attach_insert" ON storage.objects;
CREATE POLICY "fin_attach_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'financial-attachments'
  AND public.has_financial_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);

DROP POLICY IF EXISTS "fin_attach_delete" ON storage.objects;
CREATE POLICY "fin_attach_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'financial-attachments'
  AND public.has_financial_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);
