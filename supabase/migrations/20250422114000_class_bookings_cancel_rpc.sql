-- Cancelación de reservas pagas (class_bookings) con margen configurable.

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

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_class_slot(uuid, text, date, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_class_slot(uuid, text, date, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_class_slot(uuid, text, date, text, integer) TO service_role;

