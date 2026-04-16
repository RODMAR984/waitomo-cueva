-- trial_class_grants: evitar duplicados por misma sesión y habilitar limpieza segura por usuario.

-- 1) Deduplicar (conservar el más reciente por user+org+plan+fecha+slot)
DELETE FROM public.trial_class_grants t
USING public.trial_class_grants d
WHERE t.id <> d.id
  AND t.user_id = d.user_id
  AND t.organization_id = d.organization_id
  AND lower(trim(t.plan_key)) = lower(trim(d.plan_key))
  AND t.session_date = d.session_date
  AND left(trim(t.slot_label), 5) = left(trim(d.slot_label), 5)
  AND t.created_at < d.created_at;

-- 2) Clave única para permitir upsert desde app
CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_grants_session_key
  ON public.trial_class_grants (user_id, organization_id, plan_key, session_date, slot_label);

-- 3) Limpieza de grants viejos del propio usuario (para evitar acumulación)
CREATE OR REPLACE FUNCTION public.cleanup_my_old_trial_class_grants(
  p_retention_days integer DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid;
  v_days integer;
  v_deleted integer := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_days := GREATEST(COALESCE(p_retention_days, 30), 1);

  DELETE FROM public.trial_class_grants
  WHERE user_id = v_uid
    AND session_date < (CURRENT_DATE - v_days);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_my_old_trial_class_grants(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_my_old_trial_class_grants(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_my_old_trial_class_grants(integer) TO service_role;

