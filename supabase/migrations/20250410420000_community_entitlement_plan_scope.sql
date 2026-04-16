-- Comunidad (chat + novedades): trial debe coincidir con el plan cuando se evalúa un plan concreto (canales).
-- gym_news sigue usando plan NULL = cualquier trial scheduled en la sede o abono activo en la sede.

DROP POLICY IF EXISTS "Members read active news for their org" ON public.gym_news;
DROP POLICY IF EXISTS "Users can read channel by role and plan" ON public.chat_channels;
DROP POLICY IF EXISTS "Users can read messages if they can read channel" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert messages if they can read channel" ON public.chat_messages;

DROP FUNCTION IF EXISTS public.user_has_org_community_entitlement(uuid);

CREATE OR REPLACE FUNCTION public.user_has_org_community_entitlement(
  p_org_id uuid,
  p_plan_key text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid;
  nk text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR p_org_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND p.role = 'superadmin'
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND p.organization_id = p_org_id
      AND p.role IN ('owner', 'admin', 'superadmin', 'coach')
  ) THEN
    RETURN true;
  END IF;

  nk := NULL;
  IF p_plan_key IS NOT NULL AND trim(p_plan_key) <> '' THEN
    nk := public.normalize_plan_key_for_chat(p_plan_key);
    IF nk IS NULL OR nk = '' THEN
      nk := lower(trim(p_plan_key));
    END IF;
  END IF;

  IF to_regclass('public.user_abonos') IS NOT NULL THEN
    IF nk IS NULL THEN
      IF EXISTS (
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
          AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = v_uid
              AND p.organization_id = p_org_id
          )
      ) THEN
        RETURN true;
      END IF;
    ELSE
      IF EXISTS (
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
          AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = v_uid
              AND p.organization_id = p_org_id
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
  END IF;

  IF to_regclass('public.trial_class_grants') IS NOT NULL THEN
    IF nk IS NULL THEN
      IF EXISTS (
        SELECT 1
        FROM public.trial_class_grants g
        WHERE g.user_id = v_uid
          AND g.organization_id = p_org_id
          AND lower(trim(coalesce(g.status, ''))) = 'scheduled'
          AND g.session_date >= CURRENT_DATE
      ) THEN
        RETURN true;
      END IF;
    ELSE
      IF EXISTS (
        SELECT 1
        FROM public.trial_class_grants g
        WHERE g.user_id = v_uid
          AND g.organization_id = p_org_id
          AND lower(trim(coalesce(g.status, ''))) = 'scheduled'
          AND g.session_date >= CURRENT_DATE
          AND public.normalize_plan_key_for_chat(g.plan_key) = nk
      ) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_org_community_entitlement(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_org_community_entitlement(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_org_community_entitlement(uuid, text) TO service_role;

COMMENT ON FUNCTION public.user_has_org_community_entitlement(uuid, text) IS
  'Comunidad: staff/superadmin; abono activo; trial scheduled. Si p_plan_key no es null, abono/trial deben corresponder a ese plan (canales). Si p_plan_key es null, trial cualquier plan en la sede (novedades).';

CREATE POLICY "Members read active news for their org"
ON public.gym_news
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'superadmin'
    )
    OR (
      public.user_has_org_community_entitlement(gym_news.organization_id, NULL::text)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.organization_id IS NOT NULL
          AND p.organization_id = gym_news.organization_id
      )
    )
  )
);

CREATE POLICY "Users can read channel by role and plan"
ON public.chat_channels
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      p.role = 'superadmin'
      OR (
        p.organization_id IS NOT NULL
        AND p.organization_id = chat_channels.organization_id
        AND (
          p.role IN ('owner', 'admin', 'superadmin')
          OR (
            p.role = 'coach'
            AND (
              p.plan_actual IS NULL
              OR p.plan_actual = chat_channels.plan_id
              OR public.normalize_plan_key_for_chat(p.plan_actual) = chat_channels.plan_id
            )
          )
          OR (
            p.role = 'cliente'
            AND public.user_has_org_community_entitlement(chat_channels.organization_id, chat_channels.plan_id)
            AND (
              p.plan_actual = chat_channels.plan_id
              OR public.normalize_plan_key_for_chat(p.plan_actual) = chat_channels.plan_id
              OR p.plan_actual = 'all_access'
              OR public.normalize_plan_key_for_chat(p.plan_actual) = 'all_access'
            )
          )
        )
      )
    )
  )
);

CREATE POLICY "Users can read messages if they can read channel"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_channels c
    INNER JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = channel_id
    AND (
      p.role = 'superadmin'
      OR (
        p.organization_id IS NOT NULL
        AND p.organization_id = c.organization_id
        AND (
          p.role IN ('owner', 'admin', 'superadmin')
          OR (
            p.role = 'coach'
            AND (
              p.plan_actual IS NULL
              OR p.plan_actual = c.plan_id
              OR public.normalize_plan_key_for_chat(p.plan_actual) = c.plan_id
            )
          )
          OR (
            p.role = 'cliente'
            AND public.user_has_org_community_entitlement(c.organization_id, c.plan_id)
            AND (
              p.plan_actual = c.plan_id
              OR public.normalize_plan_key_for_chat(p.plan_actual) = c.plan_id
              OR p.plan_actual = 'all_access'
              OR public.normalize_plan_key_for_chat(p.plan_actual) = 'all_access'
            )
          )
        )
      )
    )
  )
);

CREATE POLICY "Users can insert messages if they can read channel"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_channels c
    INNER JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = channel_id
    AND (
      p.role = 'superadmin'
      OR (
        p.organization_id IS NOT NULL
        AND p.organization_id = c.organization_id
        AND (
          p.role IN ('owner', 'admin', 'superadmin')
          OR (
            p.role = 'coach'
            AND (
              p.plan_actual IS NULL
              OR p.plan_actual = c.plan_id
              OR public.normalize_plan_key_for_chat(p.plan_actual) = c.plan_id
            )
          )
          OR (
            p.role = 'cliente'
            AND public.user_has_org_community_entitlement(c.organization_id, c.plan_id)
            AND (
              p.plan_actual = c.plan_id
              OR public.normalize_plan_key_for_chat(p.plan_actual) = c.plan_id
              OR p.plan_actual = 'all_access'
              OR public.normalize_plan_key_for_chat(p.plan_actual) = 'all_access'
            )
          )
        )
      )
    )
  )
);
