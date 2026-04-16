-- Chat + novedades: además de pertenecer a la sede, requiere abono activo o clase de prueba agendada (scheduled).

CREATE OR REPLACE FUNCTION public.user_has_org_community_entitlement(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid;
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

  IF to_regclass('public.user_abonos') IS NOT NULL THEN
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
  END IF;

  IF to_regclass('public.trial_class_grants') IS NOT NULL THEN
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
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_org_community_entitlement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_org_community_entitlement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_org_community_entitlement(uuid) TO service_role;

COMMENT ON FUNCTION public.user_has_org_community_entitlement(uuid) IS
  'Chat/novedades: staff/superadmin, o socio con abono activo, o trial_class_grants scheduled futuro en la sede.';

-- gym_news: reemplazar política de socios
DROP POLICY IF EXISTS "Members read active news for their org" ON public.gym_news;

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
      public.user_has_org_community_entitlement(gym_news.organization_id)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.organization_id IS NOT NULL
          AND p.organization_id = gym_news.organization_id
      )
    )
  )
);

-- chat_channels / chat_messages: extender la rama "socio" (no staff) con entitlement
DROP POLICY IF EXISTS "Users can read channel by role and plan" ON public.chat_channels;

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
            AND public.user_has_org_community_entitlement(chat_channels.organization_id)
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

DROP POLICY IF EXISTS "Users can read messages if they can read channel" ON public.chat_messages;

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
            AND public.user_has_org_community_entitlement(c.organization_id)
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

DROP POLICY IF EXISTS "Users can insert messages if they can read channel" ON public.chat_messages;

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
            AND public.user_has_org_community_entitlement(c.organization_id)
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
