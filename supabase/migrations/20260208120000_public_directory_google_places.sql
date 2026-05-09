-- Directorio público (opt-in) + cache de reseña Google Places por organización.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS public_directory_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS google_place_summary jsonb DEFAULT NULL;

COMMENT ON COLUMN public.organizations.public_directory_enabled IS
  'Opt-in: el espacio puede listarse en el directorio público FitEngine.';
COMMENT ON COLUMN public.organizations.google_place_id IS
  'Google Places Place ID (detalles vía Edge Function; clave en servidor).';
COMMENT ON COLUMN public.organizations.google_place_summary IS
  'Cache JSON: rating, user_ratings_total, formatted_address, fetched_at (ISO).';

CREATE INDEX IF NOT EXISTS idx_organizations_public_directory
  ON public.organizations (public_directory_enabled)
  WHERE public_directory_enabled = true AND coalesce(active, true) = true;

-- Listado solo columnas seguras; SECURITY DEFINER para permitir anon sin abrir SELECT en organizations.
CREATE OR REPLACE FUNCTION public.list_public_organizations_directory()
RETURNS TABLE (
  id uuid,
  name text,
  type text,
  logo_url text,
  accent_color text,
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
    o.google_place_summary
  FROM public.organizations o
  WHERE coalesce(o.active, true) = true
    AND o.public_directory_enabled = true;
$$;

REVOKE ALL ON FUNCTION public.list_public_organizations_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_organizations_directory() TO anon, authenticated;
