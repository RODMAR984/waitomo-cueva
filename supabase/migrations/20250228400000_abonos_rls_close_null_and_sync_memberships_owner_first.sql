-- 1) RLS abonos: eliminar OR organization_id IS NULL (cualquier usuario autenticado veía filas huérfanas).
--    Filas legacy sin org deben backfillearse vía migración/admin (service_role sigue teniendo política aparte).
-- 2) sync_memberships_for_user: aplicar ownership ANTES que profile, para dejar explícito que no depende de fila en profiles.

DROP POLICY IF EXISTS "Users read abonos of own org" ON public.abonos;

CREATE POLICY "Users read abonos of own org"
ON public.abonos FOR SELECT TO authenticated
USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
);

CREATE OR REPLACE FUNCTION public.sync_memberships_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_org_id uuid;
  p_role text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- 1) Ownership primero: no depende de que exista fila en profiles (evita ventana post-signup).
  INSERT INTO public.organization_memberships (user_id, organization_id, role, active, is_default)
  SELECT p_user_id, o.id, 'owner', true, false
  FROM public.organizations o
  WHERE o.owner_id = p_user_id
  ON CONFLICT (user_id, organization_id, role)
  DO UPDATE SET active = true;

  -- 2) Perfil (legacy / cliente o staff en org del profile)
  SELECT organization_id, role
  INTO p_org_id, p_role
  FROM public.profiles
  WHERE id = p_user_id
  LIMIT 1;

  IF p_org_id IS NOT NULL THEN
    INSERT INTO public.organization_memberships (user_id, organization_id, role, active, is_default)
    VALUES (
      p_user_id,
      p_org_id,
      CASE
        WHEN p_role IN ('coach', 'admin', 'superadmin') THEN p_role
        ELSE 'cliente'
      END,
      true,
      false
    )
    ON CONFLICT (user_id, organization_id, role)
    DO UPDATE SET active = true;
  END IF;

  UPDATE public.organization_memberships
  SET is_default = false
  WHERE user_id = p_user_id AND active = true;

  UPDATE public.organization_memberships
  SET is_default = true
  WHERE id = (
    SELECT m.id
    FROM public.organization_memberships m
    WHERE m.user_id = p_user_id
      AND m.active = true
    ORDER BY
      CASE
        WHEN m.role IN ('owner', 'superadmin', 'admin', 'coach') THEN 0
        WHEN m.role = 'cliente' THEN 1
        ELSE 2
      END,
      m.created_at ASC
    LIMIT 1
  );
END;
$$;
