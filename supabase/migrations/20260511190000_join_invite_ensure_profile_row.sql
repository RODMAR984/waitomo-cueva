-- join_organization_with_invite: asegurar fila en profiles antes del UPDATE.
-- Si no hay fila (carrera OAuth / trigger no corrido), el UPDATE no tocaba ninguna fila y
-- sync_memberships no veía organization_id → el cliente "no era miembro" en la app.

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

  INSERT INTO public.profiles (id, role, full_name)
  SELECT
    u.id,
    COALESCE(
      CASE
        WHEN (u.raw_user_meta_data->>'role') IN ('coach', 'admin', 'superadmin')
        THEN (u.raw_user_meta_data->>'role')::text
      END,
      'cliente'
    ),
    COALESCE(
      NULLIF(
        trim(
          both FROM COALESCE(
            u.raw_user_meta_data->>'full_name',
            u.raw_user_meta_data->>'name',
            u.raw_user_meta_data->>'nombre',
            ''
          )
        ),
        ''
      ),
      ''
    )
  FROM auth.users u
  WHERE u.id = v_uid
  ON CONFLICT (id) DO NOTHING;

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
