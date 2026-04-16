-- Chat: clientes con plan_actual = 'all_access' deben ver todos los canales (antes RLS solo permitía
-- coincidencia exacta plan_actual = plan_id → lista vacía y sin mensajes).

DROP POLICY IF EXISTS "Users can read channel by role and plan" ON public.chat_channels;

CREATE POLICY "Users can read channel by role and plan"
ON public.chat_channels
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin'))
  OR
  (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'coach' AND (p.plan_actual = plan_id OR p.plan_actual IS NULL)
  ))
  OR
  (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.plan_actual = plan_id))
  OR
  (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.plan_actual = 'all_access'))
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
      p.role IN ('admin', 'superadmin')
      OR (p.role = 'coach' AND (p.plan_actual = c.plan_id OR p.plan_actual IS NULL))
      OR p.plan_actual = c.plan_id
      OR p.plan_actual = 'all_access'
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
      p.role IN ('admin', 'superadmin')
      OR (p.role = 'coach' AND (p.plan_actual = c.plan_id OR p.plan_actual IS NULL))
      OR p.plan_actual = c.plan_id
      OR p.plan_actual = 'all_access'
    )
  )
);
