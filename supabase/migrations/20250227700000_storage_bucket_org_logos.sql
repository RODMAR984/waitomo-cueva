-- =============================================================================
-- Bucket "org-logos" para logos de organizaciones (Configuración del gym)
-- =============================================================================

-- Crear el bucket (público para que la app pueda mostrar los logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public;

-- Owner de la org puede subir/actualizar logo (path: {org_id}/logo.xxx)
DROP POLICY IF EXISTS "Org owner can upload logo" ON storage.objects;
CREATE POLICY "Org owner can upload logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'org-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations WHERE owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org owner can update logo" ON storage.objects;
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
DROP POLICY IF EXISTS "Org logos are publicly readable" ON storage.objects;
CREATE POLICY "Org logos are publicly readable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'org-logos');
