-- Oleada A / 5.1 — Congelar membresía (por organización, staff via RPC).
-- Durante freeze: user_abonos.status = 'frozen' + freeze_*; el entitlement existente exige 'active'.
-- Al descongelar: vuelve a active, se limpian freeze_* y se extiende end_date por los días del freeze (inclusive).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS membership_freeze_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS membership_freeze_max_days integer NULL;

COMMENT ON COLUMN public.organizations.membership_freeze_enabled IS
  'Si true, el staff puede congelar user_abonos de la sede vía staff_freeze_user_abono.';
COMMENT ON COLUMN public.organizations.membership_freeze_max_days IS
  'Máximo de días (inclusivos) por una ventana de congelación; NULL = sin tope.';

ALTER TABLE public.user_abonos
  ADD COLUMN IF NOT EXISTS freeze_start_date date,
  ADD COLUMN IF NOT EXISTS freeze_end_date date;

COMMENT ON COLUMN public.user_abonos.freeze_start_date IS 'Inicio del período de congelación (fecha inclusive).';
COMMENT ON COLUMN public.user_abonos.freeze_end_date IS 'Fin del período de congelación (fecha inclusive).';

-- Staff: ver filas sin abono_id cuando el socio pertenece a la org (misma sede).
DROP POLICY IF EXISTS "user_abonos staff select org via client profile" ON public.user_abonos;
CREATE POLICY "user_abonos staff select org via client profile"
ON public.user_abonos
FOR SELECT
TO authenticated
USING (
  user_abonos.abono_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = user_abonos.user_id
      AND pr.organization_id IS NOT NULL
      AND public.user_is_active_org_staff(pr.organization_id)
  )
);

CREATE OR REPLACE FUNCTION public.staff_list_frozen_user_abonos(p_org_id uuid)
RETURNS TABLE (
  user_abono_id uuid,
  user_id uuid,
  display_name text,
  username text,
  plan_id text,
  abono_name text,
  freeze_start date,
  freeze_end date,
  end_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    ua.id,
    ua.user_id,
    coalesce(nullif(trim(pr.full_name), ''), nullif(trim(pr.username), ''), pr.id::text),
    coalesce(nullif(trim(pr.username), ''), ''),
    ua.plan_id,
    coalesce(nullif(trim(ab.name), ''), ua.plan_id),
    ua.freeze_start_date,
    ua.freeze_end_date,
    ua.end_date
  FROM public.user_abonos ua
  JOIN public.profiles pr ON pr.id = ua.user_id
  LEFT JOIN public.abonos ab ON ab.id = ua.abono_id
  WHERE lower(trim(coalesce(ua.status, ''))) = 'frozen'
    AND (
      ab.organization_id = p_org_id
      OR (ab.id IS NULL AND pr.organization_id = p_org_id)
    )
    AND public.user_is_active_org_staff(p_org_id);
$$;

REVOKE ALL ON FUNCTION public.staff_list_frozen_user_abonos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_frozen_user_abonos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_list_frozen_user_abonos(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.staff_freeze_user_abono(
  p_user_abono_id uuid,
  p_freeze_start date,
  p_freeze_end date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid;
  v_org_id uuid;
  v_enabled boolean;
  v_max_days integer;
  v_days integer;
  v_status text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF p_user_abono_id IS NULL OR p_freeze_start IS NULL OR p_freeze_end IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_args');
  END IF;

  IF p_freeze_end < p_freeze_start THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_date_range');
  END IF;

  SELECT
    coalesce(ab.organization_id, pr.organization_id),
    lower(trim(coalesce(ua.status, '')))
  INTO v_org_id, v_status
  FROM public.user_abonos ua
  LEFT JOIN public.abonos ab ON ab.id = ua.abono_id
  JOIN public.profiles pr ON pr.id = ua.user_id
  WHERE ua.id = p_user_abono_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF NOT public.user_is_active_org_staff(v_org_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  SELECT o.membership_freeze_enabled, o.membership_freeze_max_days
  INTO v_enabled, v_max_days
  FROM public.organizations o
  WHERE o.id = v_org_id
  LIMIT 1;

  IF NOT coalesce(v_enabled, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'feature_disabled');
  END IF;

  IF v_status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_status);
  END IF;

  v_days := (p_freeze_end - p_freeze_start + 1);
  IF v_days < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_period');
  END IF;

  IF v_max_days IS NOT NULL AND v_days > v_max_days THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'period_too_long', 'max_days', v_max_days, 'requested_days', v_days);
  END IF;

  UPDATE public.user_abonos ua
  SET
    status = 'frozen',
    freeze_start_date = p_freeze_start,
    freeze_end_date = p_freeze_end
  WHERE ua.id = p_user_abono_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'update_failed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_user_abono_id, 'freeze_days', v_days);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_freeze_user_abono(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_freeze_user_abono(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_freeze_user_abono(uuid, date, date) TO service_role;

CREATE OR REPLACE FUNCTION public.staff_unfreeze_user_abono(p_user_abono_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid;
  v_org_id uuid;
  v_status text;
  v_fs date;
  v_fe date;
  v_end date;
  v_add integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF p_user_abono_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_args');
  END IF;

  SELECT
    coalesce(ab.organization_id, pr.organization_id),
    lower(trim(coalesce(ua.status, ''))),
    ua.freeze_start_date,
    ua.freeze_end_date,
    ua.end_date
  INTO v_org_id, v_status, v_fs, v_fe, v_end
  FROM public.user_abonos ua
  LEFT JOIN public.abonos ab ON ab.id = ua.abono_id
  JOIN public.profiles pr ON pr.id = ua.user_id
  WHERE ua.id = p_user_abono_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF NOT public.user_is_active_org_staff(v_org_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  IF v_status IS DISTINCT FROM 'frozen' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_frozen', 'status', v_status);
  END IF;

  v_add := 0;
  IF v_fs IS NOT NULL AND v_fe IS NOT NULL AND v_fe >= v_fs THEN
    v_add := (v_fe - v_fs + 1);
  END IF;

  UPDATE public.user_abonos ua
  SET
    status = 'active',
    freeze_start_date = NULL,
    freeze_end_date = NULL,
    end_date = CASE
      WHEN ua.end_date IS NOT NULL AND v_add > 0 THEN ua.end_date + v_add
      ELSE ua.end_date
    END
  WHERE ua.id = p_user_abono_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'update_failed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_user_abono_id, 'extended_days', v_add, 'new_end_date', CASE WHEN v_end IS NOT NULL AND v_add > 0 THEN v_end + v_add ELSE v_end END);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_unfreeze_user_abono(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_unfreeze_user_abono(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_unfreeze_user_abono(uuid) TO service_role;
