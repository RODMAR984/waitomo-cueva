-- Unir cliente a org elegida en el directorio público (sin código de invitación).

CREATE OR REPLACE FUNCTION public.join_organization_from_directory(p_org_id uuid)
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

  IF p_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_org');
  END IF;

  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE id = p_org_id
    AND coalesce(active, true) = true
    AND coalesce(public_directory_enabled, false) = true
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_org');
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

REVOKE ALL ON FUNCTION public.join_organization_from_directory(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_organization_from_directory(uuid) TO authenticated;
