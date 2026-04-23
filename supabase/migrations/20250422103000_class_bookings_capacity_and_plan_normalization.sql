-- Normalización de plans + reservas de clases pagas + cupo por bloque.
-- Compatible con esquemas legacy donde plans.id puede ser text o uuid.

-- -----------------------------------------------------------------------------
-- 1) Normalizar plans.code y asegurar unicidad por organización.
-- -----------------------------------------------------------------------------
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS code text;

UPDATE public.plans
SET code = lower(regexp_replace(trim(coalesce(code, '')), '\s+', '_', 'g'));

UPDATE public.plans
SET code = lower(regexp_replace(trim(coalesce(title, '')), '\s+', '_', 'g'))
WHERE coalesce(code, '') = '';

UPDATE public.plans
SET code = 'plan_' || substr(md5(coalesce(id::text, gen_random_uuid()::text)), 1, 8)
WHERE coalesce(code, '') = '';

WITH ranked AS (
  SELECT
    ctid,
    organization_id,
    code,
    row_number() OVER (
      PARTITION BY organization_id, code
      ORDER BY created_at NULLS LAST, id::text
    ) AS rn
  FROM public.plans
)
UPDATE public.plans p
SET code = p.code || '_' || ranked.rn::text
FROM ranked
WHERE p.ctid = ranked.ctid
  AND ranked.rn > 1;

ALTER TABLE public.plans ALTER COLUMN code SET NOT NULL;
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_code_not_blank;
ALTER TABLE public.plans
  ADD CONSTRAINT plans_code_not_blank CHECK (char_length(trim(code)) > 0);

CREATE UNIQUE INDEX IF NOT EXISTS uq_plans_org_code
  ON public.plans (organization_id, code);

-- -----------------------------------------------------------------------------
-- 2) Endurecer plan_week_slots para plan_code (por si existe de intentos previos).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.plan_week_slots') IS NOT NULL THEN
    -- Asegura columna plan_code.
    EXECUTE 'ALTER TABLE public.plan_week_slots ADD COLUMN IF NOT EXISTS plan_code text';

    -- Si existía plan_id legacy, migra a code.
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'plan_week_slots'
        AND column_name = 'plan_id'
    ) THEN
      EXECUTE $sql$
        UPDATE public.plan_week_slots s
        SET plan_code = p.code
        FROM public.plans p
        WHERE s.plan_code IS NULL
          AND s.organization_id = p.organization_id
          AND (
            p.id::text = s.plan_id::text
            OR p.code = s.plan_id::text
          )
      $sql$;
    END IF;

    EXECUTE $sql$
      UPDATE public.plan_week_slots
      SET plan_code = lower(regexp_replace(trim(coalesce(plan_code, '')), '\s+', '_', 'g'))
    $sql$;

    EXECUTE $sql$
      DELETE FROM public.plan_week_slots
      WHERE coalesce(plan_code, '') = ''
    $sql$;

    EXECUTE $sql$
      DELETE FROM public.plan_week_slots a
      USING public.plan_week_slots b
      WHERE a.ctid < b.ctid
        AND a.organization_id = b.organization_id
        AND a.plan_code = b.plan_code
        AND a.weekday = b.weekday
        AND a.slot_label = b.slot_label
    $sql$;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3) capacity por bloque de rutina + herencia inicial desde plans.default_capacity.
-- -----------------------------------------------------------------------------
ALTER TABLE public.training_daily_blocks
  ADD COLUMN IF NOT EXISTS capacity integer;

ALTER TABLE public.training_daily_blocks
  DROP CONSTRAINT IF EXISTS training_daily_blocks_capacity_check;

ALTER TABLE public.training_daily_blocks
  ADD CONSTRAINT training_daily_blocks_capacity_check
  CHECK (capacity IS NULL OR (capacity > 0 AND capacity <= 500));

UPDATE public.training_daily_blocks b
SET capacity = p.default_capacity
FROM public.plans p
WHERE b.organization_id = p.organization_id
  AND b.capacity IS NULL
  AND p.default_capacity IS NOT NULL
  AND public.normalize_plan_key_for_chat(p.code) = public.normalize_plan_key_for_chat(b.plan_key);

COMMENT ON COLUMN public.training_daily_blocks.capacity IS
  'Cupo puntual del bloque. Si es NULL, se usa default_capacity del plan en book_class_slot.';

-- -----------------------------------------------------------------------------
-- 4) class_bookings (abonos activos) + RLS.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_key text NOT NULL,
  session_date date NOT NULL,
  slot_label text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.class_bookings DROP CONSTRAINT IF EXISTS class_bookings_status_check;
ALTER TABLE public.class_bookings
  ADD CONSTRAINT class_bookings_status_check
  CHECK (status IN ('scheduled', 'cancelled', 'completed_no_show', 'completed_attended'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_bookings_session_scheduled
  ON public.class_bookings (user_id, organization_id, plan_key, session_date, slot_label)
  WHERE lower(trim(coalesce(status, ''))) = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_class_bookings_org_date_plan
  ON public.class_bookings (organization_id, session_date, plan_key);

CREATE INDEX IF NOT EXISTS idx_class_bookings_user_status_date
  ON public.class_bookings (user_id, status, session_date DESC);

CREATE OR REPLACE FUNCTION public.set_class_bookings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_class_bookings_updated_at ON public.class_bookings;
CREATE TRIGGER trg_class_bookings_updated_at
BEFORE UPDATE ON public.class_bookings
FOR EACH ROW
EXECUTE FUNCTION public.set_class_bookings_updated_at();

ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_bookings member read own" ON public.class_bookings;
CREATE POLICY "class_bookings member read own"
ON public.class_bookings FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "class_bookings staff read org" ON public.class_bookings;
CREATE POLICY "class_bookings staff read org"
ON public.class_bookings FOR SELECT TO authenticated
USING (public.user_is_active_org_staff(organization_id));

DROP POLICY IF EXISTS "class_bookings member update own" ON public.class_bookings;
CREATE POLICY "class_bookings member update own"
ON public.class_bookings FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

GRANT SELECT, UPDATE ON public.class_bookings TO authenticated;

-- -----------------------------------------------------------------------------
-- 5) RPC: book_class_slot (abono activo + cupo + bloque existente).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_my_past_class_bookings()
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
    UPDATE public.class_bookings b
    SET
      status = 'completed_no_show',
      cancelled_at = NULL
    WHERE b.user_id = v_uid
      AND lower(trim(coalesce(b.status, ''))) = 'scheduled'
      AND b.session_date < CURRENT_DATE
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_updated FROM u;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_my_past_class_bookings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_my_past_class_bookings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_my_past_class_bookings() TO service_role;

CREATE OR REPLACE FUNCTION public.book_class_slot(
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

  IF v_block_capacity IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.training_daily_blocks b
      WHERE b.organization_id = p_organization_id
        AND b.fecha = p_session_date
        AND public.normalize_plan_key_for_chat(b.plan_key) = v_pk
        AND left(trim(coalesce(b.slot_label, '')), 5) = v_slot
    ) THEN
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
    'occupancy', v_occupancy
  );
END;
$$;

REVOKE ALL ON FUNCTION public.book_class_slot(uuid, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_class_slot(uuid, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_class_slot(uuid, text, date, text) TO service_role;

