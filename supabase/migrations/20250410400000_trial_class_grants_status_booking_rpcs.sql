-- trial_class_grants: ciclo de vida (agendar / cancelar / consumir) + RPCs atómicas.
-- Objetivo:
-- - Un solo grant "activo" por (usuario, sede, plan) en estado scheduled.
-- - Entitlement de rutina solo cuenta grants scheduled vigentes (fecha = bloque).
-- - Si la fecha de sesión ya pasó y sigue scheduled, se marca como consumida (no-show / sin aviso).

-- 1) Columnas
ALTER TABLE public.trial_class_grants
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.trial_class_grants.status IS
  'scheduled | cancelled | completed_no_show | completed_attended (extensible).';

-- Normalizar datos existentes
UPDATE public.trial_class_grants
SET status = 'scheduled'
WHERE status IS NULL OR trim(status) = '';

-- 2) Índice único: solo una reserva activa por sesión; permite historial cancelled/completed con misma clave
DROP INDEX IF EXISTS public.uq_trial_grants_session_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_grants_session_key_scheduled
  ON public.trial_class_grants (user_id, organization_id, plan_key, session_date, slot_label)
  WHERE lower(trim(coalesce(status, ''))) = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_trial_grants_user_status_session
  ON public.trial_class_grants (user_id, status, session_date DESC);

-- 3) updated_at automático
CREATE OR REPLACE FUNCTION public.set_trial_class_grants_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trial_class_grants_updated_at ON public.trial_class_grants;
CREATE TRIGGER trg_trial_class_grants_updated_at
BEFORE UPDATE ON public.trial_class_grants
FOR EACH ROW
EXECUTE FUNCTION public.set_trial_class_grants_updated_at();

-- 4) RLS: el cliente puede cancelar / marcar consumo de SUS filas (RPCs usan SECURITY DEFINER para booking)
DROP POLICY IF EXISTS "trial_grants member update own" ON public.trial_class_grants;
CREATE POLICY "trial_grants member update own"
ON public.trial_class_grants
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

GRANT UPDATE ON public.trial_class_grants TO authenticated;

-- 5) Finalizar grants vencidos (día de sesión ya pasó y sigue scheduled)
CREATE OR REPLACE FUNCTION public.finalize_my_past_trial_class_grants()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid;
  v_updated integer := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  WITH u AS (
    UPDATE public.trial_class_grants g
    SET
      status = 'completed_no_show',
      cancelled_at = NULL
    WHERE g.user_id = v_uid
      AND lower(trim(coalesce(g.status, ''))) = 'scheduled'
      AND g.session_date < CURRENT_DATE
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_updated FROM u;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_my_past_trial_class_grants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_my_past_trial_class_grants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_my_past_trial_class_grants() TO service_role;

-- 6) Cancelar reserva (respeta horas mínimas de anticipación vs inicio local del slot)
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

  v_slot5 := v_slot;
  IF position(':' in v_slot5) > 0 THEN
    v_start := timezone(
      'America/Argentina/Buenos_Aires',
      (p_session_date::text || ' ' || v_slot5)::timestamp
    );
  ELSE
    v_start := timezone(
      'America/Argentina/Buenos_Aires',
      (p_session_date::text || ' ' || v_slot5 || ':00')::timestamp
    );
  END IF;

  v_hours := GREATEST(COALESCE(p_min_notice_hours, 6), 0);
  IF v_start IS NOT NULL AND now() > (v_start - (v_hours || ' hours')::interval) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_late_to_cancel');
  END IF;

  UPDATE public.trial_class_grants g
  SET
    status = 'cancelled',
    cancelled_at = now()
  WHERE g.id = v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_my_trial_class_grant(uuid, text, date, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_my_trial_class_grant(uuid, text, date, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_my_trial_class_grant(uuid, text, date, text, integer) TO service_role;

-- 7) Reservar / reagendar: cancela otras scheduled futuras del mismo plan en la sede e inserta una nueva
CREATE OR REPLACE FUNCTION public.book_my_trial_class_grant(
  p_organization_id uuid,
  p_plan_key text,
  p_session_date date,
  p_slot_label text,
  p_contact_note text DEFAULT NULL
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
  v_row public.trial_class_grants%ROWTYPE;
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

  -- Asegura perfil pertenece a la sede (misma regla que INSERT policy)
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND p.organization_id IS NOT NULL
      AND p.organization_id = p_organization_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'org_mismatch');
  END IF;

  PERFORM public.finalize_my_past_trial_class_grants();

  UPDATE public.trial_class_grants g
  SET
    status = 'cancelled',
    cancelled_at = now()
  WHERE g.user_id = v_uid
    AND g.organization_id = p_organization_id
    AND public.normalize_plan_key_for_chat(g.plan_key) = v_pk
    AND lower(trim(coalesce(g.status, ''))) = 'scheduled'
    AND g.session_date >= CURRENT_DATE
    AND NOT (
      g.session_date = p_session_date
      AND left(trim(g.slot_label), 5) = v_slot
    );

  INSERT INTO public.trial_class_grants AS g (
    user_id,
    organization_id,
    plan_key,
    session_date,
    slot_label,
    contact_note,
    status
  ) VALUES (
    v_uid,
    p_organization_id,
    v_pk,
    p_session_date,
    v_slot,
    NULLIF(trim(coalesce(p_contact_note, '')), ''),
    'scheduled'
  )
  ON CONFLICT (user_id, organization_id, plan_key, session_date, slot_label)
  WHERE lower(trim(coalesce(status, ''))) = 'scheduled'
  DO UPDATE SET
    contact_note = COALESCE(EXCLUDED.contact_note, g.contact_note),
    status = 'scheduled',
    cancelled_at = NULL
  RETURNING * INTO v_row;

  PERFORM public.cleanup_my_old_trial_class_grants(30);

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'session_date', v_row.session_date,
    'slot_label', v_row.slot_label,
    'plan_key', v_row.plan_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.book_my_trial_class_grant(uuid, text, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_my_trial_class_grant(uuid, text, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_my_trial_class_grant(uuid, text, date, text, text) TO service_role;

-- 8) Entitlement: solo grants scheduled en la fecha del bloque
CREATE OR REPLACE FUNCTION public.user_has_active_training_entitlement(
  p_user_id uuid,
  p_org_id uuid,
  p_plan_key text,
  p_fecha date,
  p_slot_label text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  nk text;
  slot_b text;
BEGIN
  IF p_user_id IS NULL OR p_org_id IS NULL OR p_plan_key IS NULL OR p_fecha IS NULL THEN
    RETURN false;
  END IF;

  nk := public.normalize_plan_key_for_chat(p_plan_key);
  IF nk IS NULL OR nk = '' THEN
    nk := lower(trim(p_plan_key));
  END IF;

  slot_b := left(trim(coalesce(p_slot_label, '')), 5);

  IF to_regclass('public.user_abonos') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_abonos ua
      WHERE ua.user_id = p_user_id
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
          OR public.normalize_plan_key_for_chat(ua.plan_id::text) = nk
          OR EXISTS (
            SELECT 1
            FROM public.plans pl
            WHERE pl.organization_id = p_org_id
              AND (pl.id::text = ua.plan_id::text OR pl.code = ua.plan_id::text)
              AND pl.code = nk
          )
        )
    ) THEN
      RETURN true;
    END IF;
  END IF;

  IF slot_b = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.trial_class_grants g
    WHERE g.user_id = p_user_id
      AND g.organization_id = p_org_id
      AND public.normalize_plan_key_for_chat(g.plan_key) = nk
      AND g.session_date = p_fecha
      AND left(trim(g.slot_label), 5) = slot_b
      AND lower(trim(coalesce(g.status, ''))) = 'scheduled'
  );
END;
$$;

COMMENT ON FUNCTION public.user_has_active_training_entitlement(uuid, uuid, text, date, text) IS
  'True si el usuario tiene user_abonos activo que cubre plan_key de la sede, o trial_class_grants scheduled para esa fecha/slot/plan.';
