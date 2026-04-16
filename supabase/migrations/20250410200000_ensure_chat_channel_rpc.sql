-- Crea el canal de chat (organization_id + plan_id) si aún no existe — útil si faltó el seed o hay plan nuevo.

CREATE OR REPLACE FUNCTION public.ensure_chat_channel_for_org_plan(
  p_organization_id uuid,
  p_plan_id text
)
RETURNS public.chat_channels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  r public.chat_channels;
  v_plan text;
  v_name text;
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_plan := lower(trim(p_plan_id));
  IF v_plan = '' THEN
    RETURN NULL;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
     AND NOT public.user_is_active_org_staff(p_organization_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND organization_id = p_organization_id
     ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO r FROM public.chat_channels
  WHERE organization_id = p_organization_id AND plan_id = v_plan
  LIMIT 1;

  IF FOUND THEN
    RETURN r;
  END IF;

  v_name := CASE v_plan
    WHEN 'cross' THEN 'Cross Training'
    WHEN 'yoga' THEN 'Yoga'
    WHEN 'openbox' THEN 'Open Box'
    WHEN 'evolucion' THEN 'Ciclo Evolución'
    WHEN 'stretching' THEN 'Stretching'
    WHEN 'oly' THEN 'OLY'
    WHEN 'hyrox' THEN 'Hyrox'
    WHEN 'all_access' THEN 'Pase libre / todos los planes'
    ELSE initcap(replace(v_plan, '_', ' '))
  END;

  INSERT INTO public.chat_channels (organization_id, plan_id, name)
  VALUES (p_organization_id, v_plan, v_name)
  ON CONFLICT (organization_id, plan_id) DO NOTHING;

  SELECT * INTO r FROM public.chat_channels
  WHERE organization_id = p_organization_id AND plan_id = v_plan
  LIMIT 1;

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_chat_channel_for_org_plan(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_chat_channel_for_org_plan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_chat_channel_for_org_plan(uuid, text) TO service_role;

COMMENT ON FUNCTION public.ensure_chat_channel_for_org_plan IS
  'Devuelve (y crea si falta) la fila chat_channels para la sede y plan. Usar desde la app al abrir chat por plan.';
