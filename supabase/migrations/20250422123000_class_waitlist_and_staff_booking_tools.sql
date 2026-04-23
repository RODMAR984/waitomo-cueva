-- Waitlist + herramientas staff para reservas pagas (class_bookings).

CREATE TABLE IF NOT EXISTS public.class_booking_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_key text NOT NULL,
  session_date date NOT NULL,
  slot_label text NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  promoted_booking_id uuid REFERENCES public.class_bookings(id) ON DELETE SET NULL
);

ALTER TABLE public.class_booking_waitlist DROP CONSTRAINT IF EXISTS class_booking_waitlist_status_check;
ALTER TABLE public.class_booking_waitlist
  ADD CONSTRAINT class_booking_waitlist_status_check
  CHECK (status IN ('waiting', 'promoted', 'cancelled', 'expired'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_waitlist_waiting
  ON public.class_booking_waitlist (user_id, organization_id, plan_key, session_date, slot_label)
  WHERE lower(trim(coalesce(status, ''))) = 'waiting';

CREATE INDEX IF NOT EXISTS idx_class_waitlist_org_slot
  ON public.class_booking_waitlist (organization_id, session_date, plan_key, slot_label, created_at);

CREATE OR REPLACE FUNCTION public.set_class_booking_waitlist_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_class_booking_waitlist_updated_at ON public.class_booking_waitlist;
CREATE TRIGGER trg_class_booking_waitlist_updated_at
BEFORE UPDATE ON public.class_booking_waitlist
FOR EACH ROW
EXECUTE FUNCTION public.set_class_booking_waitlist_updated_at();

ALTER TABLE public.class_booking_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_waitlist member read own" ON public.class_booking_waitlist;
CREATE POLICY "class_waitlist member read own"
ON public.class_booking_waitlist FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "class_waitlist staff read org" ON public.class_booking_waitlist;
CREATE POLICY "class_waitlist staff read org"
ON public.class_booking_waitlist FOR SELECT TO authenticated
USING (public.user_is_active_org_staff(organization_id));

DROP POLICY IF EXISTS "class_waitlist member update own" ON public.class_booking_waitlist;
CREATE POLICY "class_waitlist member update own"
ON public.class_booking_waitlist FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

GRANT SELECT, UPDATE ON public.class_booking_waitlist TO authenticated;

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

REVOKE ALL ON FUNCTION public.promote_waitlist_for_slot(uuid, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_waitlist_for_slot(uuid, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_waitlist_for_slot(uuid, text, date, text) TO service_role;

CREATE OR REPLACE FUNCTION public.join_class_waitlist(
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
  v_uid uuid;
  v_pk text;
  v_slot text;
  v_att text;
  v_plan_capacity integer;
  v_block_capacity integer;
  v_capacity integer;
  v_occupancy integer;
  v_id uuid;
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

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.join_class_waitlist(uuid, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_class_waitlist(uuid, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_class_waitlist(uuid, text, date, text) TO service_role;

CREATE OR REPLACE FUNCTION public.leave_class_waitlist(
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
  v_uid uuid;
  v_pk text;
  v_slot text;
  v_id uuid;
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

  SELECT w.id INTO v_id
  FROM public.class_booking_waitlist w
  WHERE w.user_id = v_uid
    AND w.organization_id = p_organization_id
    AND public.normalize_plan_key_for_chat(w.plan_key) = v_pk
    AND w.session_date = p_session_date
    AND left(trim(w.slot_label), 5) = v_slot
    AND lower(trim(coalesce(w.status, ''))) = 'waiting'
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  UPDATE public.class_booking_waitlist
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.leave_class_waitlist(uuid, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_class_waitlist(uuid, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_class_waitlist(uuid, text, date, text) TO service_role;

CREATE OR REPLACE FUNCTION public.staff_cancel_class_booking(
  p_booking_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid;
  v_b public.class_bookings%ROWTYPE;
  v_promoted jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_b
  FROM public.class_bookings
  WHERE id = p_booking_id
    AND lower(trim(coalesce(status, ''))) = 'scheduled'
  LIMIT 1;

  IF v_b.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF NOT public.user_is_active_org_staff(v_b.organization_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  UPDATE public.class_bookings b
  SET
    status = 'cancelled',
    cancelled_at = now(),
    notes = trim(coalesce(b.notes, '') || case when p_reason is null or trim(p_reason) = '' then '' else ' | staff_cancel: ' || trim(p_reason) end)
  WHERE b.id = v_b.id;

  v_promoted := public.promote_waitlist_for_slot(v_b.organization_id, v_b.plan_key, v_b.session_date, v_b.slot_label);
  RETURN jsonb_build_object('ok', true, 'id', v_b.id, 'promoted', coalesce((v_promoted->>'promoted')::integer, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.staff_cancel_class_booking(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_cancel_class_booking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_cancel_class_booking(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.staff_move_class_booking(
  p_booking_id uuid,
  p_new_slot_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid;
  v_b public.class_bookings%ROWTYPE;
  v_slot text;
  v_pk text;
  v_att text;
  v_plan_capacity integer;
  v_block_capacity integer;
  v_capacity integer;
  v_occupancy integer;
  v_new_id uuid;
  v_promoted jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  v_slot := left(trim(coalesce(p_new_slot_label, '')), 5);
  IF v_slot = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_slot');
  END IF;

  SELECT * INTO v_b
  FROM public.class_bookings
  WHERE id = p_booking_id
    AND lower(trim(coalesce(status, ''))) = 'scheduled'
  LIMIT 1;
  IF v_b.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.user_is_active_org_staff(v_b.organization_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;
  IF left(trim(v_b.slot_label), 5) = v_slot THEN
    RETURN jsonb_build_object('ok', true, 'id', v_b.id, 'slot_label', v_slot);
  END IF;

  v_pk := public.normalize_plan_key_for_chat(v_b.plan_key);

  SELECT
    coalesce(pl.attendance_policy, 'dropin'),
    pl.default_capacity
  INTO v_att, v_plan_capacity
  FROM public.plans pl
  WHERE pl.organization_id = v_b.organization_id
    AND public.normalize_plan_key_for_chat(pl.code) = v_pk
  ORDER BY pl.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_att NOT IN ('booking_required', 'dropin_capped') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'booking_not_enabled');
  END IF;

  SELECT b.capacity
  INTO v_block_capacity
  FROM public.training_daily_blocks b
  WHERE b.organization_id = v_b.organization_id
    AND b.fecha = v_b.session_date
    AND public.normalize_plan_key_for_chat(b.plan_key) = v_pk
    AND left(trim(coalesce(b.slot_label, '')), 5) = v_slot
  ORDER BY b.updated_at DESC NULLS LAST, b.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_block_capacity IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.training_daily_blocks b
      WHERE b.organization_id = v_b.organization_id
        AND b.fecha = v_b.session_date
        AND public.normalize_plan_key_for_chat(b.plan_key) = v_pk
        AND left(trim(coalesce(b.slot_label, '')), 5) = v_slot
    ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slot_not_found');
  END IF;

  v_capacity := coalesce(v_block_capacity, v_plan_capacity);
  IF v_capacity IS NULL OR v_capacity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'capacity_missing');
  END IF;

  SELECT count(*)::integer
  INTO v_occupancy
  FROM public.class_bookings cb
  WHERE cb.organization_id = v_b.organization_id
    AND cb.session_date = v_b.session_date
    AND public.normalize_plan_key_for_chat(cb.plan_key) = v_pk
    AND left(trim(coalesce(cb.slot_label, '')), 5) = v_slot
    AND lower(trim(coalesce(cb.status, ''))) = 'scheduled';

  IF v_occupancy >= v_capacity THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'full');
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
    v_b.organization_id,
    v_b.user_id,
    v_b.plan_key,
    v_b.session_date,
    v_slot,
    'scheduled',
    trim(coalesce(v_b.notes, '') || ' | staff_move_from:' || left(trim(v_b.slot_label), 5))
  )
  ON CONFLICT (user_id, organization_id, plan_key, session_date, slot_label)
  WHERE lower(trim(coalesce(status, ''))) = 'scheduled'
  DO UPDATE SET
    status = 'scheduled',
    cancelled_at = NULL
  RETURNING cb.id INTO v_new_id;

  UPDATE public.class_bookings
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = v_b.id;

  v_promoted := public.promote_waitlist_for_slot(v_b.organization_id, v_b.plan_key, v_b.session_date, v_b.slot_label);

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_new_id,
    'old_id', v_b.id,
    'slot_label', v_slot,
    'promoted', coalesce((v_promoted->>'promoted')::integer, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_move_class_booking(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_move_class_booking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_move_class_booking(uuid, text) TO service_role;

-- Reemplaza cancel_class_slot para promover waitlist al liberar un cupo por cancelación del usuario.
CREATE OR REPLACE FUNCTION public.cancel_class_slot(
  p_organization_id uuid,
  p_plan_key text,
  p_session_date date,
  p_slot_label text,
  p_min_notice_hours integer DEFAULT 2
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
  v_id uuid;
  v_promoted jsonb;
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

  v_start := timezone(
    'America/Argentina/Buenos_Aires',
    (p_session_date::text || ' ' || v_slot || ':00')::timestamp
  );
  v_hours := GREATEST(COALESCE(p_min_notice_hours, 2), 0);

  IF v_start IS NOT NULL AND now() > (v_start - (v_hours || ' hours')::interval) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_late_to_cancel');
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

