-- =============================================================================
-- Políticas de Storage para el bucket "avatars" (fotos de perfil)
-- Ejecutá este script en Supabase: SQL Editor → New query → Pegar → Run
-- =============================================================================
-- Sin estas políticas, la app falla con: "new row violates row-level security policy"
-- La app sube archivos con path: {user_id}/avatar.jpg (cada usuario en su carpeta)
-- =============================================================================

-- 1) Permitir a usuarios autenticados SUBIR solo en su carpeta (nombre = auth.uid())
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2) Permitir ACTUALIZAR (upsert) solo su propio archivo
CREATE POLICY "Users can update own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) Permitir LEER todos los avatares (para getPublicUrl / mostrar fotos)
CREATE POLICY "Avatar images are publicly readable"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- =============================================================================
-- Si el bucket "avatars" no existe, crealo antes en Dashboard:
-- Storage → New bucket → Name: avatars → Public: ON (para leer sin auth)
-- =============================================================================
