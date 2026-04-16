-- Permite a staff de una org (owner, admin, coach, superadmin) listar todas las filas
-- de organization_memberships de esa org (panel Miembros, finanzas, etc.).
-- La política existente solo permitía SELECT donde user_id = auth.uid().

DROP POLICY IF EXISTS "Staff read org memberships" ON public.organization_memberships;

CREATE POLICY "Staff read org memberships"
ON public.organization_memberships
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships sm
    WHERE sm.user_id = auth.uid()
      AND sm.organization_id = organization_memberships.organization_id
      AND sm.active = true
      AND sm.role IN ('owner', 'admin', 'coach', 'superadmin')
  )
);
