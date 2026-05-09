-- Incluir google_place_id en el directorio público (enlaces “Abrir en Maps” con query_place_id).
-- Postgres no permite cambiar el RETURNS TABLE con CREATE OR REPLACE: DROP + CREATE.

DROP FUNCTION IF EXISTS public.list_public_organizations_directory();

CREATE FUNCTION public.list_public_organizations_directory()
RETURNS TABLE (
  id uuid,
  name text,
  type text,
  logo_url text,
  accent_color text,
  google_place_id text,
  google_place_summary jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.name,
    o.type,
    o.logo_url,
    o.accent_color,
    o.google_place_id,
    o.google_place_summary
  FROM public.organizations o
  WHERE coalesce(o.active, true) = true
    AND o.public_directory_enabled = true;
$$;

REVOKE ALL ON FUNCTION public.list_public_organizations_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_organizations_directory() TO anon, authenticated;
