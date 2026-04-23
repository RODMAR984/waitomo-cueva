-- Horas mínimas de aviso para cancelar reservas, configurable por plan.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS cancel_notice_hours integer;

UPDATE public.plans
SET cancel_notice_hours = 2
WHERE cancel_notice_hours IS NULL
  AND coalesce(attendance_policy, 'dropin') IN ('booking_required', 'dropin_capped');

ALTER TABLE public.plans
  ALTER COLUMN cancel_notice_hours SET DEFAULT 2;

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_cancel_notice_hours_check;

ALTER TABLE public.plans
  ADD CONSTRAINT plans_cancel_notice_hours_check
  CHECK (cancel_notice_hours IS NULL OR (cancel_notice_hours >= 0 AND cancel_notice_hours <= 72));

COMMENT ON COLUMN public.plans.cancel_notice_hours IS
  'Horas mínimas de aviso para cancelar una reserva paga de clase.';

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

  v_start := timezone(
    'America/Argentina/Buenos_Aires',
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

