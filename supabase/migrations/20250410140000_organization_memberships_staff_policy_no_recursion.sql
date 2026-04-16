-- La política "Staff read org memberships" consultaba organization_memberships
-- dentro del USING, lo que re-disparaba RLS en la misma tabla → recursión infinita.
-- Solución: comprobar staff en una función SECURITY DEFINER sin aplicar RLS al SELECT interno.

CREATE OR REPLACE FUNCTION public.user_is_active_org_staff(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = p_org_id
      AND m.active = true
      AND m.role IN ('owner', 'admin', 'coach', 'superadmin')
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_active_org_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_active_org_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_active_org_staff(uuid) TO service_role;

DROP POLICY IF EXISTS "Staff read org memberships" ON public.organization_memberships;

CREATE POLICY "Staff read org memberships"
ON public.organization_memberships
FOR SELECT
TO authenticated
USING (public.user_is_active_org_staff(organization_id));
