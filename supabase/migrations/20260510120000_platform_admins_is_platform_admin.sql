-- Panel plataforma (FitEngine): fuente operativa de “soy admin de plataforma”.
-- Ver docs/ROADMAP_SUPERADMIN_PLATFORM_PANEL.md

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  notes text,
  active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_active_true
  ON public.platform_admins (user_id)
  WHERE active = true;

COMMENT ON TABLE public.platform_admins IS
  'Admins de la plataforma FitEngine (no confundir con owner de una org). La app usa fila active=true; grants vía SQL/Supabase Studio.';

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admins select own row" ON public.platform_admins;
CREATE POLICY "platform_admins select own row"
ON public.platform_admins
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Sin INSERT/UPDATE/DELETE para authenticated: altas solo service_role / SQL.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid()
      AND COALESCE(pa.active, false) = true
  );
$$;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'True si auth.uid() tiene fila activa en platform_admins. SECURITY DEFINER + search_path fijo (roadmap).';

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO service_role;
