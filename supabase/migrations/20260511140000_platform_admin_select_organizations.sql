-- Fase 5 (impersonación): lectura de organizations para admins de plataforma.
-- Las políticas existentes cubren perfil.organization_id y owner_id; esto suma OR explícito.

DROP POLICY IF EXISTS "Platform admins read organizations" ON public.organizations;
CREATE POLICY "Platform admins read organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (public.is_platform_admin());
