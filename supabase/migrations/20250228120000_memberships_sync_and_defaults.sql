-- Endurece el modelo de memberships para que sea funcional en producción:
-- 1) Sincroniza memberships desde profiles y organizations.owner_id.
-- 2) Mantiene un único default activo por usuario.
-- 3) Define default determinista: staff > cliente.

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

  -- Desde profile actual (legacy/source)
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

  -- Desde ownership de organizaciones
  INSERT INTO public.organization_memberships (user_id, organization_id, role, active, is_default)
  SELECT p_user_id, o.id, 'owner', true, false
  FROM public.organizations o
  WHERE o.owner_id = p_user_id
  ON CONFLICT (user_id, organization_id, role)
  DO UPDATE SET active = true;

  -- Default determinista: staff > cliente (uno solo por usuario)
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

DROP TRIGGER IF EXISTS trg_profiles_sync_memberships ON public.profiles;
DROP FUNCTION IF EXISTS public.trg_sync_memberships_from_profile();
CREATE OR REPLACE FUNCTION public.trg_sync_memberships_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_memberships_for_user(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_sync_memberships
AFTER INSERT OR UPDATE OF organization_id, role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_memberships_from_profile();

DROP TRIGGER IF EXISTS trg_organizations_sync_memberships ON public.organizations;
DROP FUNCTION IF EXISTS public.trg_sync_memberships_from_organization();
CREATE OR REPLACE FUNCTION public.trg_sync_memberships_from_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    PERFORM public.sync_memberships_for_user(NEW.owner_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_sync_memberships
AFTER INSERT OR UPDATE OF owner_id ON public.organizations
FOR EACH ROW
WHEN (NEW.owner_id IS NOT NULL)
EXECUTE FUNCTION public.trg_sync_memberships_from_organization();

-- Backfill global para dejar todo consistente ahora
DO $$
DECLARE
  u uuid;
BEGIN
  FOR u IN
    SELECT DISTINCT id FROM public.profiles
    UNION
    SELECT DISTINCT owner_id FROM public.organizations WHERE owner_id IS NOT NULL
  LOOP
    PERFORM public.sync_memberships_for_user(u);
  END LOOP;
END $$;

