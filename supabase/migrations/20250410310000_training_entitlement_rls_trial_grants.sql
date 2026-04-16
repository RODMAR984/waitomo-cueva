-- Acceso a training_daily_blocks: abono activo (user_abonos) o clase de prueba (trial_class_grants).
-- La lectura por socio ya no basta con plan_actual; debe cumplir entitlement.

-- 1) user_abonos: asegurar tabla base (la app ya la usa; IF NOT EXISTS no rompe prod)
CREATE TABLE IF NOT EXISTS public.user_abonos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  abono_id uuid REFERENCES public.abonos(id) ON DELETE SET NULL,
  plan_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  start_date date,
  end_date date,
  sessions_total integer,
  sessions_used integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_abonos_user_created
  ON public.user_abonos (user_id, created_at DESC);

-- 2) Clase de prueba confirmada en servidor (además del AsyncStorage en app)
CREATE TABLE IF NOT EXISTS public.trial_class_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_key text NOT NULL,
  session_date date NOT NULL,
  slot_label text NOT NULL,
  contact_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_grants_user_created
  ON public.trial_class_grants (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trial_grants_org_date
  ON public.trial_class_grants (organization_id, session_date DESC);

COMMENT ON TABLE public.trial_class_grants IS
  'Permiso puntual para ver rutina del día (misma fecha/horario/plan) sin abono; inserta el cliente al confirmar clase gratis.';

ALTER TABLE public.trial_class_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trial_grants read own" ON public.trial_class_grants;
CREATE POLICY "trial_grants read own"
ON public.trial_class_grants
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "trial_grants staff org read" ON public.trial_class_grants;
CREATE POLICY "trial_grants staff org read"
ON public.trial_class_grants
FOR SELECT
TO authenticated
USING (public.user_is_active_org_staff(organization_id));

DROP POLICY IF EXISTS "trial_grants member insert own org" ON public.trial_class_grants;
CREATE POLICY "trial_grants member insert own org"
ON public.trial_class_grants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1)
);

GRANT SELECT, INSERT ON public.trial_class_grants TO authenticated;
GRANT ALL ON public.trial_class_grants TO service_role;

-- 3) ¿Puede el socio leer filas de rutina para este plan/fecha/slot?
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
AS $$
DECLARE
  nk text;
  slot_a text;
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

  -- Abono activo que cubre el plan del bloque (o pase libre)
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

  -- Clase de prueba: misma org, plan, fecha y franja horaria
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
  );
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_active_training_entitlement(uuid, uuid, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_active_training_entitlement(uuid, uuid, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_active_training_entitlement(uuid, uuid, text, date, text) TO service_role;

-- 4) Reemplazar política de socios: misma org + entitlement (abono o trial)
DROP POLICY IF EXISTS "training_blocks members read by plan" ON public.training_daily_blocks;

CREATE POLICY "training_blocks members read by plan"
ON public.training_daily_blocks
FOR SELECT
TO authenticated
USING (
  NOT public.user_is_active_org_staff(training_daily_blocks.organization_id)
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.organization_id IS NOT NULL
      AND p.organization_id = training_daily_blocks.organization_id
  )
  AND public.user_has_active_training_entitlement(
    auth.uid(),
    training_daily_blocks.organization_id,
    training_daily_blocks.plan_key,
    training_daily_blocks.fecha,
    training_daily_blocks.slot_label
  )
);

COMMENT ON FUNCTION public.user_has_active_training_entitlement IS
  'True si el usuario tiene user_abonos activo que cubre plan_key de la sede, o trial_class_grants para esa fecha/slot/plan.';
