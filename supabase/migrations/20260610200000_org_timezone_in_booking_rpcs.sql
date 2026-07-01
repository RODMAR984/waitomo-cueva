-- Cancelaciones de clase: usar organizations.timezone en lugar de AR fijo.

CREATE OR REPLACE FUNCTION public.org_timezone(p_organization_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(nullif(trim(o.timezone), ''), 'America/Argentina/Buenos_Aires')
  FROM public.organizations o
  WHERE o.id = p_organization_id;
$$;

COMMENT ON FUNCTION public.org_timezone(uuid) IS
  'Zona IANA de la sede; fallback Buenos Aires si falta.';

REVOKE ALL ON FUNCTION public.org_timezone(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_timezone(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_timezone(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_class_slot(
  p_organization_id uuid,
  p_plan_key text,
  p_session_date date,
  p_slot_label text,
  p_min_notice_hours integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid;
  v_pk text;
  v_slot text;
  v_start timestamptz;
  v_hours integer;
  v_plan_hours integer;
  v_id uuid;
  v_promoted jsonb;
  v_tz text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_organization_id IS NULL OR p_plan_key IS NULL OR p_session_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  END IF;

  v_pk := public.normalize_plan_key_for_chat(p_plan_key);
  IF v_pk IS NULL OR v_pk = '' THEN
    v_pk := lower(trim(p_plan_key));
  END IF;

  v_slot := left(trim(coalesce(p_slot_label, '')), 5);
  IF v_slot = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_slot');
  END IF;

  PERFORM public.finalize_my_past_class_bookings();

  SELECT b.id INTO v_id
  FROM public.class_bookings b
  WHERE b.user_id = v_uid
    AND b.organization_id = p_organization_id
    AND public.normalize_plan_key_for_chat(b.plan_key) = v_pk
    AND b.session_date = p_session_date
    AND left(trim(b.slot_label), 5) = v_slot
    AND lower(trim(coalesce(b.status, ''))) = 'scheduled'
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT pl.cancel_notice_hours
  INTO v_plan_hours
  FROM public.plans pl
  WHERE pl.organization_id = p_organization_id
    AND public.normalize_plan_key_for_chat(pl.code) = v_pk
  ORDER BY pl.created_at DESC NULLS LAST
  LIMIT 1;

  v_tz := public.org_timezone(p_organization_id);
  v_start := timezone(
    v_tz,
    (p_session_date::text || ' ' || v_slot || ':00')::timestamp
  );
  v_hours := GREATEST(COALESCE(p_min_notice_hours, v_plan_hours, 2), 0);

  IF v_start IS NOT NULL AND now() > (v_start - (v_hours || ' hours')::interval) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_late_to_cancel', 'min_notice_hours', v_hours);
  END IF;

  UPDATE public.class_bookings b
  SET
    status = 'cancelled',
    cancelled_at = now()
  WHERE b.id = v_id;

  v_promoted := public.promote_waitlist_for_slot(p_organization_id, v_pk, p_session_date, v_slot);
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'promoted', coalesce((v_promoted->>'promoted')::integer, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_my_trial_class_grant(
  p_organization_id uuid,
  p_plan_key text,
  p_session_date date,
  p_slot_label text,
  p_min_notice_hours integer DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid;
  v_pk text;
  v_slot text;
  v_slot5 text;
  v_start timestamptz;
  v_hours integer;
  v_id uuid;
  v_tz text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_organization_id IS NULL OR p_plan_key IS NULL OR p_session_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  END IF;

  v_pk := public.normalize_plan_key_for_chat(p_plan_key);
  IF v_pk IS NULL OR v_pk = '' THEN
    v_pk := lower(trim(p_plan_key));
  END IF;

  v_slot := left(trim(coalesce(p_slot_label, '')), 5);
  IF v_slot = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_slot');
  END IF;

  PERFORM public.finalize_my_past_trial_class_grants();

  SELECT g.id INTO v_id
  FROM public.trial_class_grants g
  WHERE g.user_id = v_uid
    AND g.organization_id = p_organization_id
    AND public.normalize_plan_key_for_chat(g.plan_key) = v_pk
    AND g.session_date = p_session_date
    AND left(trim(g.slot_label), 5) = v_slot
    AND lower(trim(coalesce(g.status, ''))) = 'scheduled'
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  v_tz := public.org_timezone(p_organization_id);
  v_slot5 := v_slot;
  IF position(':' in v_slot5) > 0 THEN
    v_start := timezone(v_tz, (p_session_date::text || ' ' || v_slot5)::timestamp);
  ELSE
    v_start := timezone(v_tz, (p_session_date::text || ' ' || v_slot5 || ':00')::timestamp);
  END IF;

  v_hours := GREATEST(COALESCE(p_min_notice_hours, 6), 0);
  IF v_start IS NOT NULL AND now() > (v_start - (v_hours || ' hours')::interval) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_late_to_cancel');
  END IF;

  UPDATE public.trial_class_grants g
  SET status = 'cancelled', cancelled_at = now()
  WHERE g.id = v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;
