-- Bucket "org-backgrounds" para fondos de organización (misma idea que org-logos)

INSERT INTO storage.buckets (id, name, public)
VALUES ('org-backgrounds', 'org-backgrounds', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public;

DROP POLICY IF EXISTS "Org owner can upload background" ON storage.objects;
CREATE POLICY "Org owner can upload background"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'org-backgrounds'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations WHERE owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org owner can update background" ON storage.objects;
CREATE POLICY "Org owner can update background"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'org-backgrounds'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'org-backgrounds'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations WHERE owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org backgrounds are publicly readable" ON storage.objects;
CREATE POLICY "Org backgrounds are publicly readable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'org-backgrounds');
