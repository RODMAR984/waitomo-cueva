-- Coaches solo veían canales cuyo plan_id coincidía con profiles.plan_actual.
-- Si el plan en perfil no normaliza al mismo plan_id que en chat_channels, la lista queda vacía
-- y la app muestra el mensaje de "crear en Supabase" aunque los canales existan.
-- Staff de la sede debe ver (y usar) todos los canales de su organization_id.

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
          OR p.role = 'coach'
          OR (
            p.plan_actual = chat_channels.plan_id
            OR public.normalize_plan_key_for_chat(p.plan_actual) = chat_channels.plan_id
            OR p.plan_actual = 'all_access'
            OR public.normalize_plan_key_for_chat(p.plan_actual) = 'all_access'
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
          OR p.role = 'coach'
          OR (
            p.plan_actual = c.plan_id
            OR public.normalize_plan_key_for_chat(p.plan_actual) = c.plan_id
            OR p.plan_actual = 'all_access'
            OR public.normalize_plan_key_for_chat(p.plan_actual) = 'all_access'
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
  auth.uid() = user_id
  AND EXISTS (
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
          OR p.role = 'coach'
          OR (
            p.plan_actual = c.plan_id
            OR public.normalize_plan_key_for_chat(p.plan_actual) = c.plan_id
            OR p.plan_actual = 'all_access'
            OR public.normalize_plan_key_for_chat(p.plan_actual) = 'all_access'
          )
        )
      )
    )
  )
);
