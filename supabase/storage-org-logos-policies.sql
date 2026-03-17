-- =============================================================================
-- Storage: bucket "org-logos" para logos de organizaciones
-- Crear el bucket en Dashboard: Storage → New bucket → Name: org-logos → Public: ON
-- Luego ejecutar este script en SQL Editor.
-- =============================================================================

-- Owner de la org puede subir/actualizar logo en carpeta de su org (path: {org_id}/logo.xxx)
CREATE POLICY "Org owner can upload logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Org owner can update logo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations WHERE owner_id = auth.uid()
  )
);

-- Lectura pública para mostrar logos
CREATE POLICY "Org logos are publicly readable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'org-logos');
