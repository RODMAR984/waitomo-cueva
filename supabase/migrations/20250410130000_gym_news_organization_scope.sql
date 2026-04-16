-- Novedades (gym_news) multi-tenant: mismas filas para todos los gimnasios → aislar por organization_id.

ALTER TABLE public.gym_news
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.gym_news n
SET organization_id = (
  SELECT id FROM public.organizations WHERE name = 'Waitomo Training' LIMIT 1
)
WHERE n.organization_id IS NULL;

UPDATE public.gym_news n
SET organization_id = (SELECT id FROM public.organizations ORDER BY created_at ASC NULLS LAST LIMIT 1)
WHERE n.organization_id IS NULL;

ALTER TABLE public.gym_news
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gym_news_organization_id ON public.gym_news (organization_id);

DROP INDEX IF EXISTS idx_gym_news_active_pinned_created;

CREATE INDEX IF NOT EXISTS idx_gym_news_org_active_pinned_created
ON public.gym_news (organization_id, is_active, pinned DESC, created_at DESC)
WHERE is_active = true;

-- Políticas anteriores (lectura global + staff)
DROP POLICY IF EXISTS "Authenticated can read active news" ON public.gym_news;
DROP POLICY IF EXISTS "Admins can insert news" ON public.gym_news;
DROP POLICY IF EXISTS "Admins can update news" ON public.gym_news;
DROP POLICY IF EXISTS "Staff can insert news" ON public.gym_news;
DROP POLICY IF EXISTS "Staff can update news" ON public.gym_news;
DROP POLICY IF EXISTS "Staff can read all news rows" ON public.gym_news;

-- Re-ejecución segura (si falló a mitad o corriste el SQL dos veces)
DROP POLICY IF EXISTS "Members read active news for their org" ON public.gym_news;
DROP POLICY IF EXISTS "Staff read all news rows for their org" ON public.gym_news;
DROP POLICY IF EXISTS "Staff insert news for their org" ON public.gym_news;
DROP POLICY IF EXISTS "Staff update news for their org" ON public.gym_news;

-- Clientes / lectura pública autenticada: solo novedades activas de su organización
CREATE POLICY "Members read active news for their org"
ON public.gym_news
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'superadmin'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.organization_id IS NOT NULL
      AND p.organization_id = gym_news.organization_id
    )
  )
);

-- Staff: ver todas las filas (activas e inactivas) de su org
CREATE POLICY "Staff read all news rows for their org"
ON public.gym_news
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'superadmin'
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id IS NOT NULL
    AND p.organization_id = gym_news.organization_id
    AND p.role IN ('admin', 'superadmin', 'coach')
  )
);

CREATE POLICY "Staff insert news for their org"
ON public.gym_news
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'superadmin'
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id IS NOT NULL
    AND p.organization_id = organization_id
    AND p.role IN ('admin', 'superadmin', 'coach')
  )
);

CREATE POLICY "Staff update news for their org"
ON public.gym_news
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'superadmin'
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id IS NOT NULL
    AND p.organization_id = gym_news.organization_id
    AND p.role IN ('admin', 'superadmin', 'coach')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'superadmin'
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id IS NOT NULL
    AND p.organization_id = organization_id
    AND p.role IN ('admin', 'superadmin', 'coach')
  )
);
