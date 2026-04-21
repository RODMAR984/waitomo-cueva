-- user_abonos: RLS para que el socio lea/inserte/actualice lo suyo y el staff del gym lea filas de su org (panel Resumen).

ALTER TABLE public.user_abonos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_abonos superadmin select all" ON public.user_abonos;
CREATE POLICY "user_abonos superadmin select all"
ON public.user_abonos
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
);

DROP POLICY IF EXISTS "user_abonos member select own" ON public.user_abonos;
CREATE POLICY "user_abonos member select own"
ON public.user_abonos
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_abonos staff select org via abono" ON public.user_abonos;
CREATE POLICY "user_abonos staff select org via abono"
ON public.user_abonos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.abonos a
    WHERE a.id = user_abonos.abono_id
      AND public.user_is_active_org_staff(a.organization_id)
  )
);

DROP POLICY IF EXISTS "user_abonos member insert own" ON public.user_abonos;
CREATE POLICY "user_abonos member insert own"
ON public.user_abonos
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_abonos member update own" ON public.user_abonos;
CREATE POLICY "user_abonos member update own"
ON public.user_abonos
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
