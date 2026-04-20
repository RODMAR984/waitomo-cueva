-- Permite leer abonos por membresías activas de organización, no solo por profiles.organization_id.
-- Alinea RLS de abonos con la lógica de plans para clientes invitados / multi-org.

DROP POLICY IF EXISTS "Users read abonos of own org" ON public.abonos;
DROP POLICY IF EXISTS "Users read abonos of member orgs" ON public.abonos;

CREATE POLICY "Users read abonos of member orgs"
ON public.abonos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.organization_id = abonos.organization_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = abonos.organization_id
      AND m.active = true
  )
);
