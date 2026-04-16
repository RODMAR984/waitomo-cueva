-- FIX: la función entitlement debe ignorar RLS internamente.
-- SECURITY DEFINER + SET row_security = off evita que la lectura de user_abonos / trial_class_grants
-- falle por políticas de RLS (cuando se evalúa desde una policy de training_daily_blocks).

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

