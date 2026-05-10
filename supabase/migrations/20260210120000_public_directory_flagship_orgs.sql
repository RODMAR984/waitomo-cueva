-- Directorio público: orgs históricas / vitrina que no pasaron por el toggle de Gym Config
-- siguen con public_directory_enabled = false (DEFAULT de 20260208120000).
-- La RPC list_public_organizations_directory solo lista filas con public_directory_enabled = true.
--
-- Esta migración activa listado + marca términos en `features` (misma clave que GymConfigScreen
-- PUBLIC_DIRECTORY_TERMS_DOC_VERSION = 'v2') para espacios cuyo nombre coincide con Waitomo / Marti Tu Coach,
-- sin tocar el resto de organizaciones (opt-in explícito sigue siendo el camino normal).

UPDATE public.organizations o
SET
  public_directory_enabled = true,
  features =
    coalesce(o.features, '{}'::jsonb)
    || jsonb_build_object(
      'public_directory_terms_v1',
      to_jsonb((clock_timestamp() AT TIME ZONE 'utc')::text),
      'public_directory_terms_doc_version',
      to_jsonb('v2'::text)
    )
WHERE coalesce(o.active, true) = true
  AND (
    lower(trim(o.name)) LIKE '%waitomo%'
    OR lower(trim(o.name)) LIKE '%marti tu coach%'
    OR lower(trim(o.name)) LIKE '%martí tu coach%'
    OR (
      lower(trim(o.name)) LIKE '%marti%'
      AND lower(trim(o.name)) LIKE '%coach%'
    )
  );
