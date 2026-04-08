-- Permite al dueño leer sus organizaciones aunque profiles.organization_id
-- apunte a otra (ej. cliente en Waitomo + coach con org propia).
-- La política existente solo permitía SELECT donde id = profiles.organization_id.
DROP POLICY IF EXISTS "Owners read organizations they own" ON public.organizations;
CREATE POLICY "Owners read organizations they own"
ON public.organizations
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());
