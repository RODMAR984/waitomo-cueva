-- Oleadas 5.3–5.9 (producto): métricas dashboard, retención in-app, comisiones coach/plan,
-- campos Stripe en org (capa 1 preparatoria), badges por asistencias, tablas auxiliares.

-- ---------------------------------------------------------------------------
-- 5.5 Stripe (org): IDs públicos / flags; secretos solo en Edge / env, no en DB.
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.stripe_connect_account_id IS 'Stripe Connect account id (acct_…); configuración en panel admin.';
COMMENT ON COLUMN public.organizations.stripe_checkout_enabled IS 'Cuando exista checkout integrado, habilita cobros; hasta entonces es bandera de intención.';

-- ---------------------------------------------------------------------------
-- 5.4 Comisiones coach × plan (bps = basis points, 100 = 1%)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_plan_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  coach_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_key text NOT NULL,
  commission_bps integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_plan_commissions_bps_range CHECK (commission_bps >= 0 AND commission_bps <= 10000),
  CONSTRAINT coach_plan_commissions_plan_key_nonempty CHECK (length(trim(plan_key)) > 0),
  CONSTRAINT coach_plan_commissions_unique UNIQUE (organization_id, coach_user_id, plan_key)
);

CREATE INDEX IF NOT EXISTS idx_coach_plan_commissions_org ON public.coach_plan_commissions (organization_id);

ALTER TABLE public.coach_plan_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_plan_commissions staff read org" ON public.coach_plan_commissions;
CREATE POLICY "coach_plan_commissions staff read org"
ON public.coach_plan_commissions FOR SELECT TO authenticated
USING (public.user_is_active_org_staff(organization_id));

DROP POLICY IF EXISTS "coach_plan_commissions staff write org" ON public.coach_plan_commissions;
CREATE POLICY "coach_plan_commissions staff write org"
ON public.coach_plan_commissions FOR INSERT TO authenticated
WITH CHECK (public.user_is_active_org_staff(organization_id));

DROP POLICY IF EXISTS "coach_plan_commissions staff update org" ON public.coach_plan_commissions;
CREATE POLICY "coach_plan_commissions staff update org"
ON public.coach_plan_commissions FOR UPDATE TO authenticated
USING (public.user_is_active_org_staff(organization_id))
WITH CHECK (public.user_is_active_org_staff(organization_id));

DROP POLICY IF EXISTS "coach_plan_commissions staff delete org" ON public.coach_plan_commissions;
CREATE POLICY "coach_plan_commissions staff delete org"
ON public.coach_plan_commissions FOR DELETE TO authenticated
USING (public.user_is_active_org_staff(organization_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_plan_commissions TO authenticated;

-- ---------------------------------------------------------------------------
-- 5.2 Retención: nudges in-app (sin depender de proveedor de email en v1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.in_app_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_in_app_nudges_user_unread
  ON public.in_app_nudges (user_id, read_at)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_in_app_nudges_org_created
  ON public.in_app_nudges (organization_id, created_at DESC);

ALTER TABLE public.in_app_nudges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "in_app_nudges read own" ON public.in_app_nudges;
CREATE POLICY "in_app_nudges read own"
ON public.in_app_nudges FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "in_app_nudges staff insert org" ON public.in_app_nudges;
CREATE POLICY "in_app_nudges staff insert org"
ON public.in_app_nudges FOR INSERT TO authenticated
WITH CHECK (public.user_is_active_org_staff(organization_id));

DROP POLICY IF EXISTS "in_app_nudges update own read" ON public.in_app_nudges;
CREATE POLICY "in_app_nudges update own read"
ON public.in_app_nudges FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.in_app_nudges TO authenticated;

-- ---------------------------------------------------------------------------
-- 5.9 Badges
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.badge_definitions (
  id text PRIMARY KEY,
  title_es text NOT NULL,
  title_en text NOT NULL,
  rule_type text NOT NULL,
  rule_threshold integer NOT NULL CHECK (rule_threshold > 0)
);

INSERT INTO public.badge_definitions (id, title_es, title_en, rule_type, rule_threshold)
VALUES
  ('first_class', 'Primera clase', 'First class', 'classes_attended_count', 1),
  ('ten_classes', '10 clases', '10 classes', 'classes_attended_count', 10),
  ('thirty_classes', '30 clases', '30 classes', 'classes_attended_count', 30)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  badge_id text NOT NULL REFERENCES public.badge_definitions(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_org ON public.user_badges (organization_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_badges read own" ON public.user_badges;
CREATE POLICY "user_badges read own"
ON public.user_badges FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_badges staff read org" ON public.user_badges;
CREATE POLICY "user_badges staff read org"
ON public.user_badges FOR SELECT TO authenticated
USING (public.user_is_active_org_staff(organization_id));

GRANT SELECT ON public.user_badges TO authenticated;
GRANT SELECT ON public.badge_definitions TO authenticated;

-- ---------------------------------------------------------------------------
-- 5.3 RPC: 4 métricas (JSON)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_org_dashboard_metrics(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_active_clients integer;
  v_bookings_7d integer;
  v_active_passes integer;
  v_attended_30d integer;
BEGIN
  IF p_org_id IS NULL OR NOT public.user_is_active_org_staff(p_org_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  SELECT count(*)::integer INTO v_active_clients
  FROM public.organization_memberships m
  WHERE m.organization_id = p_org_id
    AND m.active = true
    AND lower(trim(coalesce(m.role, ''))) = 'cliente';

  SELECT count(*)::integer INTO v_bookings_7d
  FROM public.class_bookings cb
  WHERE cb.organization_id = p_org_id
    AND lower(trim(coalesce(cb.status, ''))) = 'scheduled'
    AND cb.session_date >= CURRENT_DATE
    AND cb.session_date < (CURRENT_DATE + 8);

  SELECT count(*)::integer INTO v_active_passes
  FROM public.user_abonos ua
  LEFT JOIN public.abonos ab ON ab.id = ua.abono_id
  JOIN public.profiles pr ON pr.id = ua.user_id
  WHERE lower(trim(coalesce(ua.status, ''))) = 'active'
    AND (ua.end_date IS NULL OR ua.end_date >= CURRENT_DATE)
    AND (ua.start_date IS NULL OR ua.start_date <= CURRENT_DATE)
    AND (
      ab.organization_id = p_org_id
      OR (ab.id IS NULL AND pr.organization_id = p_org_id)
    );

  SELECT count(*)::integer INTO v_attended_30d
  FROM public.class_bookings cb
  WHERE cb.organization_id = p_org_id
    AND lower(trim(coalesce(cb.status, ''))) = 'completed_attended'
    AND cb.session_date >= (CURRENT_DATE - 30);

  RETURN jsonb_build_object(
    'ok', true,
    'active_clients', coalesce(v_active_clients, 0),
    'bookings_scheduled_7d', coalesce(v_bookings_7d, 0),
    'active_passes', coalesce(v_active_passes, 0),
    'classes_attended_30d', coalesce(v_attended_30d, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_org_dashboard_metrics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_org_dashboard_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_org_dashboard_metrics(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 5.2 RPC: socios sin reserva/asistencia reciente (dormant)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_list_dormant_clients(p_org_id uuid, p_days integer DEFAULT 14)
RETURNS TABLE (user_id uuid, display_name text, username text, last_session date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_days integer;
BEGIN
  IF p_org_id IS NULL OR NOT public.user_is_active_org_staff(p_org_id) THEN
    RETURN;
  END IF;
  v_days := greatest(1, least(coalesce(p_days, 14), 365));

  RETURN QUERY
  WITH clients AS (
    SELECT m.user_id
    FROM public.organization_memberships m
    WHERE m.organization_id = p_org_id
      AND m.active = true
      AND lower(trim(coalesce(m.role, ''))) = 'cliente'
  ),
  last_sess AS (
    SELECT cb.user_id, max(cb.session_date)::date AS last_session
    FROM public.class_bookings cb
    WHERE cb.organization_id = p_org_id
      AND lower(trim(coalesce(cb.status, ''))) IN ('scheduled', 'completed_attended', 'completed_no_show')
    GROUP BY cb.user_id
  )
  SELECT
    pr.id,
    coalesce(nullif(trim(pr.full_name), ''), nullif(trim(pr.username), ''), pr.id::text),
    coalesce(nullif(trim(pr.username), ''), ''),
    ls.last_session
  FROM clients c
  JOIN public.profiles pr ON pr.id = c.user_id
  LEFT JOIN last_sess ls ON ls.user_id = c.user_id
  WHERE ls.last_session IS NULL
     OR ls.last_session < (CURRENT_DATE - (v_days || ' days')::interval)
  ORDER BY 2;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list_dormant_clients(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_dormant_clients(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_list_dormant_clients(uuid, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 5.2 RPC: enviar nudge in-app (máx 1 cada 7 días por socio y sede)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_send_in_app_nudge(
  p_org_id uuid,
  p_target_user_id uuid,
  p_body text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_body text;
  v_recent integer;
  v_member boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF p_org_id IS NULL OR p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_args');
  END IF;
  IF NOT public.user_is_active_org_staff(p_org_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  v_body := left(trim(coalesce(p_body, '')), 2000);
  IF length(v_body) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'body_too_short');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    WHERE m.organization_id = p_org_id
      AND m.user_id = p_target_user_id
      AND m.active = true
      AND lower(trim(coalesce(m.role, ''))) = 'cliente'
  ) INTO v_member;
  IF NOT coalesce(v_member, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_org_client');
  END IF;

  SELECT count(*)::integer INTO v_recent
  FROM public.in_app_nudges n
  WHERE n.organization_id = p_org_id
    AND n.user_id = p_target_user_id
    AND n.created_at > (now() - interval '7 days');

  IF coalesce(v_recent, 0) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  INSERT INTO public.in_app_nudges (organization_id, user_id, body)
  VALUES (p_org_id, p_target_user_id, v_body);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_send_in_app_nudge(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_send_in_app_nudge(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_send_in_app_nudge(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_in_app_nudge_read(p_nudge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  UPDATE public.in_app_nudges n
  SET read_at = now()
  WHERE n.id = p_nudge_id
    AND n.user_id = auth.uid()
    AND n.read_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_in_app_nudge_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_in_app_nudge_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_in_app_nudge_read(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 5.9 RPC: recalcular badges por asistencias (completed_attended)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_refresh_badges_for_org(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_new integer := 0;
BEGIN
  IF p_org_id IS NULL OR NOT public.user_is_active_org_staff(p_org_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_staff');
  END IF;

  WITH ins AS (
    INSERT INTO public.user_badges (user_id, organization_id, badge_id)
    SELECT s.user_id, p_org_id, d.id
    FROM public.badge_definitions d
    INNER JOIN (
      SELECT cb.user_id, count(*)::integer AS cnt
      FROM public.class_bookings cb
      WHERE cb.organization_id = p_org_id
        AND lower(trim(coalesce(cb.status, ''))) = 'completed_attended'
      GROUP BY cb.user_id
    ) s ON s.cnt >= d.rule_threshold AND d.rule_type = 'classes_attended_count'
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_new FROM ins;

  RETURN jsonb_build_object('ok', true, 'badges_new_rows', coalesce(v_new, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.staff_refresh_badges_for_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_refresh_badges_for_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_refresh_badges_for_org(uuid) TO service_role;
