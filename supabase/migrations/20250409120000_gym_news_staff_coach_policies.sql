-- gym_news: coaches (y staff) pueden crear/editar novedades como en el panel Admin.
-- Antes solo admin/superadmin pasaban RLS → coaches veían error al guardar.
-- SELECT: se agrega política para que staff lea también filas inactivas (panel de gestión).

DROP POLICY IF EXISTS "Admins can insert news" ON public.gym_news;
DROP POLICY IF EXISTS "Admins can update news" ON public.gym_news;
DROP POLICY IF EXISTS "Staff can insert news" ON public.gym_news;
DROP POLICY IF EXISTS "Staff can update news" ON public.gym_news;
DROP POLICY IF EXISTS "Staff can read all news rows" ON public.gym_news;

CREATE POLICY "Staff can insert news"
ON public.gym_news
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'coach')
  )
);

CREATE POLICY "Staff can update news"
ON public.gym_news
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'coach')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'coach')
  )
);

CREATE POLICY "Staff can read all news rows"
ON public.gym_news
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin', 'coach')
  )
);
