-- Código de invitación para clientes (por gym) + RPC para unirse sin tocar la tabla a mano.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS client_invite_code varchar(16);

COMMENT ON COLUMN public.organizations.client_invite_code IS 'Código corto único; el cliente lo usa en la app o en waitomo://join?code=...';

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_client_invite_code_unique
  ON public.organizations (upper(trim(client_invite_code)))
  WHERE client_invite_code IS NOT NULL AND btrim(client_invite_code) <> '';

-- -----------------------------------------------------------------------------
-- join_organization_with_invite: asocia el usuario autenticado a la org (solo rol cliente).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_organization_with_invite(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_code');
  END IF;

  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE upper(trim(client_invite_code)) = upper(trim(p_code))
    AND coalesce(active, true) = true
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid LIMIT 1;

  IF v_role IS NOT NULL AND lower(v_role) <> 'cliente' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'role_not_client');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND organization_id IS NOT DISTINCT FROM v_org_id
  ) THEN
    PERFORM public.sync_memberships_for_user(v_uid);
    RETURN jsonb_build_object('ok', true, 'organization_id', v_org_id, 'already', true);
  END IF;

  UPDATE public.profiles
  SET organization_id = v_org_id,
      role = 'cliente'
  WHERE id = v_uid;

  PERFORM public.sync_memberships_for_user(v_uid);

  RETURN jsonb_build_object('ok', true, 'organization_id', v_org_id, 'already', false);
END;
$$;

REVOKE ALL ON FUNCTION public.join_organization_with_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_organization_with_invite(text) TO authenticated;
