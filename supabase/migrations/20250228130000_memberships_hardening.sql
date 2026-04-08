-- Hardening enterprise para memberships:
-- 1) Integridad: un único default activo por usuario.
-- 2) Coherencia: is_default solo si active=true.
-- 3) RPC atómica para setear contexto/default por membership del usuario actual.

-- 1) Check de coherencia
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_memberships_default_requires_active'
  ) THEN
    ALTER TABLE public.organization_memberships
      ADD CONSTRAINT organization_memberships_default_requires_active
      CHECK (NOT is_default OR active);
  END IF;
END $$;

-- 2) Índice único parcial: máximo 1 default activo por usuario
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_memberships_one_default_active_per_user
ON public.organization_memberships (user_id)
WHERE active = true AND is_default = true;

-- 3) RPC segura para cambiar default (atómica, valida ownership por auth.uid)
CREATE OR REPLACE FUNCTION public.set_default_membership(p_membership_id uuid)
RETURNS public.organization_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_row public.organization_memberships;
BEGIN
  IF p_membership_id IS NULL THEN
    RAISE EXCEPTION 'membership_id requerido';
  END IF;

  SELECT user_id
  INTO v_user_id
  FROM public.organization_memberships
  WHERE id = p_membership_id
    AND active = true
    AND user_id = auth.uid()
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Membership no encontrada o sin permiso';
  END IF;

  -- bajar defaults activos del usuario
  UPDATE public.organization_memberships
  SET is_default = false
  WHERE user_id = v_user_id
    AND active = true
    AND is_default = true;

  -- subir el seleccionado
  UPDATE public.organization_memberships
  SET is_default = true
  WHERE id = p_membership_id
    AND user_id = v_user_id
    AND active = true
  RETURNING *
  INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_default_membership(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_default_membership(uuid) TO authenticated;

