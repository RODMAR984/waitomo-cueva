-- Directorio público: paginación + filtro opcional por tipo (gym | coach).
-- Firma nueva: reemplazar función (DROP + CREATE).

DROP FUNCTION IF EXISTS public.list_public_organizations_directory();

CREATE FUNCTION public.list_public_organizations_directory(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_type text DEFAULT NULL
)
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
    AND o.public_directory_enabled = true
    AND (
      p_type IS NULL
      OR (p_type IN ('gym', 'coach') AND o.type = p_type)
    )
  ORDER BY
    CASE
      WHEN o.google_place_summary IS NOT NULL
        AND (o.google_place_summary->>'rating') ~ '^[0-9]+(\.[0-9]+)?$'
      THEN (o.google_place_summary->>'rating')::numeric
      ELSE NULL
    END DESC NULLS LAST,
    o.name ASC,
    o.id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.list_public_organizations_directory(integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_organizations_directory(integer, integer, text) TO anon, authenticated;
