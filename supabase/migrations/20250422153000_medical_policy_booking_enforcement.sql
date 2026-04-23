-- Política de apto médico configurable por organización para reservas.
-- Fuente: organizations.features.medical_clearance_policy
-- {
--   "mode": "strict" | "grace" | "flexible",
--   "grace_days": 7
-- }

CREATE OR REPLACE FUNCTION public.evaluate_medical_clearance_policy(
  p_organization_id uuid,
  p_user_id uuid,
  p_session_date date,
  p_accept_responsibility boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_features jsonb;
  v_mode text := 'strict';
  v_grace_days integer := 0;
  v_apto_url text;
  v_expires_at timestamptz;
  v_expires_date date;
  v_session_date date := coalesce(p_session_date, CURRENT_DATE);
  v_state text := 'missing';
  v_expired_days integer := 0;
BEGIN
  IF p_organization_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('allow', false, 'reason', 'invalid_payload');
  END IF;

  SELECT o.features
  INTO v_features
  FROM public.organizations o
  WHERE o.id = p_organization_id
  LIMIT 1;

  v_mode := lower(trim(coalesce(v_features->'medical_clearance_policy'->>'mode', 'strict')));
  IF v_mode NOT IN ('strict', 'grace', 'flexible') THEN
    v_mode := 'strict';
  END IF;

  BEGIN
    v_grace_days := greatest(coalesce((v_features->'medical_clearance_policy'->>'grace_days')::integer, 0), 0);
  EXCEPTION WHEN OTHERS THEN
    v_grace_days := 0;
  END;

  SELECT
    p.apto_medico_url,
    p.apto_medico_expires_at
  INTO v_apto_url, v_expires_at
  FROM public.profiles p
  WHERE p.id = p_user_id
    AND p.organization_id = p_organization_id
  LIMIT 1;

  IF coalesce(trim(v_apto_url), '') = '' THEN
    v_state := 'missing';
  ELSE
    v_expires_date := CASE WHEN v_expires_at IS NULL THEN NULL ELSE v_expires_at::date END;
    IF v_expires_date IS NULL THEN
      v_state := 'valid';
    ELSIF v_session_date > v_expires_date THEN
      v_state := 'expired';
      v_expired_days := greatest((v_session_date - v_expires_date), 0);
    ELSE
      v_state := 'valid';
    END IF;
  END IF;

  IF v_state = 'valid' THEN
    RETURN jsonb_build_object(
      'allow', true,
      'state', v_state,
      'mode', v_mode,
      'grace_days', v_grace_days,
      'expired_days', 0
    );
  END IF;

  IF v_mode = 'grace' AND v_state = 'expired' AND v_expired_days <= v_grace_days THEN
    RETURN jsonb_build_object(
      'allow', true,
      'state', v_state,
      'mode', v_mode,
      'grace_days', v_grace_days,
      'expired_days', v_expired_days
    );
  END IF;

  IF v_mode = 'flexible' THEN
    IF p_accept_responsibility THEN
      RETURN jsonb_build_object(
        'allow', true,
        'state', v_state,
        'mode', v_mode,
        'grace_days', v_grace_days,
        'expired_days', v_expired_days,
        'accepted_responsibility', true
      );
    END IF;
    RETURN jsonb_build_object(
      'allow', false,
      'reason', 'medical_responsibility_required',
      'state', v_state,
      'mode', v_mode,
      'grace_days', v_grace_days,
      'expired_days', v_expired_days
    );
  END IF;

  RETURN jsonb_build_object(
    'allow', false,
    'reason', 'medical_blocked',
    'state', v_state,
    'mode', v_mode,
    'grace_days', v_grace_days,
    'expired_days', v_expired_days
  );
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_medical_clearance_policy(uuid, uuid, date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_medical_clearance_policy(uuid, uuid, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_medical_clearance_policy(uuid, uuid, date, boolean) TO service_role;

DROP FUNCTION IF EXISTS public.book_class_slot(uuid, text, date, text, boolean);
DROP FUNCTION IF EXISTS public.book_class_slot(uuid, text, date, text);

CREATE OR REPLACE FUNCTION public.book_class_slot(
  p_organization_id uuid,
  p_plan_key text,
  p_session_date date,
  p_slot_label text,
  p_accept_medical_responsibility boolean DEFAULT false
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
  v_att text;
  v_plan_capacity integer;
  v_block_capacity integer;
  v_capacity integer;
  v_occupancy integer;
  v_id uuid;
  v_has_block boolean := false;
  v_has_week_slot boolean := false;
  v_weekday integer;
  v_med jsonb;
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

  IF p_session_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'date_in_past');
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = v_uid
        AND p.organization_id = p_organization_id
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.user_id = v_uid
        AND m.organization_id = p_organization_id
        AND m.active = true
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'org_mismatch');
  END IF;

  v_med := public.evaluate_medical_clearance_policy(
    p_organization_id,
    v_uid,
    p_session_date,
    coalesce(p_accept_medical_responsibility, false)
  );
  IF coalesce((v_med->>'allow')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', coalesce(v_med->>'reason', 'medical_blocked'), 'medical', v_med);
  END IF;

  SELECT
    coalesce(pl.attendance_policy, 'dropin'),
    pl.default_capacity
  INTO v_att, v_plan_capacity
  FROM public.plans pl
  WHERE pl.organization_id = p_organization_id
    AND public.normalize_plan_key_for_chat(pl.code) = v_pk
  ORDER BY pl.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_att IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plan_not_found');
  END IF;

  IF v_att NOT IN ('booking_required', 'dropin_capped') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'booking_not_enabled');
  END IF;

  IF to_regclass('public.user_abonos') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'abonos_table_missing');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_abonos ua
    WHERE ua.user_id = v_uid
      AND lower(trim(coalesce(ua.status, ''))) = 'active'
      AND (ua.end_date IS NULL OR ua.end_date >= CURRENT_DATE)
      AND (ua.start_date IS NULL OR ua.start_date <= CURRENT_DATE)
      AND (
        ua.sessions_total IS NULL
        OR ua.sessions_total <= 0
        OR coalesce(ua.sessions_used, 0) < ua.sessions_total
      )
      AND (
        public.normalize_plan_key_for_chat(ua.plan_id::text) = 'all_access'
        OR public.normalize_plan_key_for_chat(ua.plan_id::text) = v_pk
        OR EXISTS (
          SELECT 1
          FROM public.plans pl
          WHERE pl.organization_id = p_organization_id
            AND (pl.id::text = ua.plan_id::text OR pl.code = ua.plan_id::text)
            AND public.normalize_plan_key_for_chat(pl.code) = v_pk
        )
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_active_membership');
  END IF;

  SELECT b.capacity
  INTO v_block_capacity
  FROM public.training_daily_blocks b
  WHERE b.organization_id = p_organization_id
    AND b.fecha = p_session_date
    AND public.normalize_plan_key_for_chat(b.plan_key) = v_pk
    AND left(trim(coalesce(b.slot_label, '')), 5) = v_slot
  ORDER BY b.updated_at DESC NULLS LAST, b.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.training_daily_blocks b
    WHERE b.organization_id = p_organization_id
      AND b.fecha = p_session_date
      AND public.normalize_plan_key_for_chat(b.plan_key) = v_pk
      AND left(trim(coalesce(b.slot_label, '')), 5) = v_slot
  ) INTO v_has_block;

  v_weekday := extract(isodow from p_session_date)::integer;
  IF to_regclass('public.plan_week_slots') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.plan_week_slots s
      WHERE s.organization_id = p_organization_id
        AND public.normalize_plan_key_for_chat(s.plan_code) = v_pk
        AND s.weekday = v_weekday
        AND left(trim(coalesce(s.slot_label, '')), 5) = v_slot
    ) INTO v_has_week_slot;
  END IF;

  IF NOT v_has_block AND NOT v_has_week_slot THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slot_not_found');
  END IF;

  v_capacity := coalesce(v_block_capacity, v_plan_capacity);
  IF v_capacity IS NULL OR v_capacity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'capacity_missing');
  END IF;

  PERFORM public.finalize_my_past_class_bookings();

  SELECT count(*)::integer
  INTO v_occupancy
  FROM public.class_bookings cb
  WHERE cb.organization_id = p_organization_id
    AND cb.session_date = p_session_date
    AND public.normalize_plan_key_for_chat(cb.plan_key) = v_pk
    AND left(trim(coalesce(cb.slot_label, '')), 5) = v_slot
    AND lower(trim(coalesce(cb.status, ''))) = 'scheduled';

  IF v_occupancy >= v_capacity THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'full',
      'occupancy', v_occupancy,
      'capacity', v_capacity
    );
  END IF;

  INSERT INTO public.class_bookings AS cb (
    organization_id,
    user_id,
    plan_key,
    session_date,
    slot_label,
    status
  ) VALUES (
    p_organization_id,
    v_uid,
    v_pk,
    p_session_date,
    v_slot,
    'scheduled'
  )
  ON CONFLICT (user_id, organization_id, plan_key, session_date, slot_label)
  WHERE lower(trim(coalesce(status, ''))) = 'scheduled'
  DO UPDATE SET
    status = 'scheduled',
    cancelled_at = NULL
  RETURNING cb.id INTO v_id;

  SELECT count(*)::integer
  INTO v_occupancy
  FROM public.class_bookings cb
  WHERE cb.organization_id = p_organization_id
    AND cb.session_date = p_session_date
    AND public.normalize_plan_key_for_chat(cb.plan_key) = v_pk
    AND left(trim(coalesce(cb.slot_label, '')), 5) = v_slot
    AND lower(trim(coalesce(cb.status, ''))) = 'scheduled';

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_id,
    'plan_key', v_pk,
    'session_date', p_session_date,
    'slot_label', v_slot,
    'capacity', v_capacity,
    'occupancy', v_occupancy,
    'medical', v_med
  );
END;
$$;

REVOKE ALL ON FUNCTION public.book_class_slot(uuid, text, date, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_class_slot(uuid, text, date, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_class_slot(uuid, text, date, text, boolean) TO service_role;

DROP FUNCTION IF EXISTS public.join_class_waitlist(uuid, text, date, text, boolean);
DROP FUNCTION IF EXISTS public.join_class_waitlist(uuid, text, date, text);

CREATE OR REPLACE FUNCTION public.join_class_waitlist(
  p_organization_id uuid,
  p_plan_key text,
  p_session_date date,
  p_slot_label text,
  p_accept_medical_responsibility boolean DEFAULT false
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
  v_att text;
  v_plan_capacity integer;
  v_block_capacity integer;
  v_capacity integer;
  v_occupancy integer;
  v_id uuid;
  v_med jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_pk := public.normalize_plan_key_for_chat(p_plan_key);
  IF v_pk IS NULL OR v_pk = '' THEN
    v_pk := lower(trim(p_plan_key));
  END IF;
  v_slot := left(trim(coalesce(p_slot_label, '')), 5);
  IF p_organization_id IS NULL OR p_session_date IS NULL OR v_pk = '' OR v_slot = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  END IF;

  v_med := public.evaluate_medical_clearance_policy(
    p_organization_id,
    v_uid,
    p_session_date,
    coalesce(p_accept_medical_responsibility, false)
  );
  IF coalesce((v_med->>'allow')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', coalesce(v_med->>'reason', 'medical_blocked'), 'medical', v_med);
  END IF;

  SELECT
    coalesce(pl.attendance_policy, 'dropin'),
    pl.default_capacity
  INTO v_att, v_plan_capacity
  FROM public.plans pl
  WHERE pl.organization_id = p_organization_id
    AND public.normalize_plan_key_for_chat(pl.code) = v_pk
  ORDER BY pl.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_att IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plan_not_found');
  END IF;
  IF v_att NOT IN ('booking_required', 'dropin_capped') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'booking_not_enabled');
  END IF;

  SELECT b.capacity
  INTO v_block_capacity
  FROM public.training_daily_blocks b
  WHERE b.organization_id = p_organization_id
    AND b.fecha = p_session_date
    AND public.normalize_plan_key_for_chat(b.plan_key) = v_pk
    AND left(trim(coalesce(b.slot_label, '')), 5) = v_slot
  ORDER BY b.updated_at DESC NULLS LAST, b.created_at DESC NULLS LAST
  LIMIT 1;

  v_capacity := coalesce(v_block_capacity, v_plan_capacity);
  IF v_capacity IS NULL OR v_capacity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'capacity_missing');
  END IF;

  SELECT count(*)::integer
  INTO v_occupancy
  FROM public.class_bookings cb
  WHERE cb.organization_id = p_organization_id
    AND cb.session_date = p_session_date
    AND public.normalize_plan_key_for_chat(cb.plan_key) = v_pk
    AND left(trim(coalesce(cb.slot_label, '')), 5) = v_slot
    AND lower(trim(coalesce(cb.status, ''))) = 'scheduled';

  IF v_occupancy < v_capacity THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slot_available');
  END IF;

  INSERT INTO public.class_booking_waitlist AS w (
    organization_id,
    user_id,
    plan_key,
    session_date,
    slot_label,
    status
  ) VALUES (
    p_organization_id,
    v_uid,
    v_pk,
    p_session_date,
    v_slot,
    'waiting'
  )
  ON CONFLICT (user_id, organization_id, plan_key, session_date, slot_label)
  WHERE lower(trim(coalesce(status, ''))) = 'waiting'
  DO UPDATE SET
    status = 'waiting',
    cancelled_at = NULL
  RETURNING w.id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'medical', v_med);
END;
$$;

REVOKE ALL ON FUNCTION public.join_class_waitlist(uuid, text, date, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_class_waitlist(uuid, text, date, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_class_waitlist(uuid, text, date, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.promote_waitlist_for_slot(
  p_organization_id uuid,
  p_plan_key text,
  p_session_date date,
  p_slot_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_pk text;
  v_slot text;
  v_plan_capacity integer;
  v_block_capacity integer;
  v_capacity integer;
  v_occupancy integer;
  v_wait public.class_booking_waitlist%ROWTYPE;
  v_booking_id uuid;
  v_promoted integer := 0;
  v_med jsonb;
BEGIN
  v_pk := public.normalize_plan_key_for_chat(p_plan_key);
  IF v_pk IS NULL OR v_pk = '' THEN
    v_pk := lower(trim(p_plan_key));
  END IF;
  v_slot := left(trim(coalesce(p_slot_label, '')), 5);
  IF p_organization_id IS NULL OR p_session_date IS NULL OR v_pk = '' OR v_slot = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  END IF;

  SELECT
    coalesce(pl.default_capacity, NULL)
  INTO v_plan_capacity
  FROM public.plans pl
  WHERE pl.organization_id = p_organization_id
    AND public.normalize_plan_key_for_chat(pl.code) = v_pk
  ORDER BY pl.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT b.capacity
  INTO v_block_capacity
  FROM public.training_daily_blocks b
  WHERE b.organization_id = p_organization_id
    AND b.fecha = p_session_date
    AND public.normalize_plan_key_for_chat(b.plan_key) = v_pk
    AND left(trim(coalesce(b.slot_label, '')), 5) = v_slot
  ORDER BY b.updated_at DESC NULLS LAST, b.created_at DESC NULLS LAST
  LIMIT 1;

  v_capacity := coalesce(v_block_capacity, v_plan_capacity);
  IF v_capacity IS NULL OR v_capacity <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'promoted', 0, 'reason', 'capacity_missing');
  END IF;

  LOOP
    SELECT count(*)::integer
    INTO v_occupancy
    FROM public.class_bookings cb
    WHERE cb.organization_id = p_organization_id
      AND cb.session_date = p_session_date
      AND public.normalize_plan_key_for_chat(cb.plan_key) = v_pk
      AND left(trim(coalesce(cb.slot_label, '')), 5) = v_slot
      AND lower(trim(coalesce(cb.status, ''))) = 'scheduled';

    EXIT WHEN v_occupancy >= v_capacity;

    SELECT *
    INTO v_wait
    FROM public.class_booking_waitlist w
    WHERE w.organization_id = p_organization_id
      AND w.session_date = p_session_date
      AND public.normalize_plan_key_for_chat(w.plan_key) = v_pk
      AND left(trim(coalesce(w.slot_label, '')), 5) = v_slot
      AND lower(trim(coalesce(w.status, ''))) = 'waiting'
    ORDER BY w.created_at ASC
    LIMIT 1;

    EXIT WHEN v_wait.id IS NULL;

    v_med := public.evaluate_medical_clearance_policy(
      p_organization_id,
      v_wait.user_id,
      p_session_date,
      false
    );
    IF coalesce((v_med->>'allow')::boolean, false) IS NOT TRUE THEN
      UPDATE public.class_booking_waitlist w
      SET
        status = 'expired',
        cancelled_at = now()
      WHERE w.id = v_wait.id;
      CONTINUE;
    END IF;

    INSERT INTO public.class_bookings AS cb (
      organization_id,
      user_id,
      plan_key,
      session_date,
      slot_label,
      status,
      notes
    ) VALUES (
      p_organization_id,
      v_wait.user_id,
      v_pk,
      p_session_date,
      v_slot,
      'scheduled',
      'promoted_from_waitlist'
    )
    ON CONFLICT (user_id, organization_id, plan_key, session_date, slot_label)
    WHERE lower(trim(coalesce(status, ''))) = 'scheduled'
    DO UPDATE SET
      status = 'scheduled',
      cancelled_at = NULL
    RETURNING cb.id INTO v_booking_id;

    UPDATE public.class_booking_waitlist w
    SET
      status = 'promoted',
      promoted_booking_id = v_booking_id,
      cancelled_at = NULL
    WHERE w.id = v_wait.id;

    v_promoted := v_promoted + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'promoted', v_promoted);
END;
$$;

