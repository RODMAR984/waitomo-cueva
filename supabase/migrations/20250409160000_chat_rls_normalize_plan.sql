-- Alinear RLS con la lógica de la app (ClientScreen.normalizePlanKey): cross_training → cross, etc.
-- Sin esto, plan_actual en profiles puede no coincidir exactamente con chat_channels.plan_id.

CREATE OR REPLACE FUNCTION public.normalize_plan_key_for_chat(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NULL OR btrim(raw) = '' THEN NULL::text
    WHEN lower(raw) LIKE '%cross%' THEN 'cross'::text
    WHEN lower(raw) LIKE '%hyrox%' THEN 'hyrox'::text
    WHEN lower(raw) LIKE '%evol%' THEN 'evolucion'::text
    WHEN lower(raw) LIKE '%stretch%' THEN 'stretching'::text
    WHEN lower(raw) LIKE '%yoga%' THEN 'yoga'::text
    WHEN lower(raw) LIKE '%open%' THEN 'openbox'::text
    WHEN lower(raw) LIKE '%oly%' OR lower(raw) LIKE '%olímp%' THEN 'oly'::text
    WHEN lower(raw) IN ('all_access', 'all access', 'pase_total', 'pase libre')
      OR lower(raw) LIKE 'all_access%'
      OR lower(raw) LIKE '%all_access%' THEN 'all_access'::text
    ELSE regexp_replace(lower(btrim(raw)), '[[:space:]]+', '_', 'g')
  END;
$$;

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
    WHERE p.id = auth.uid()
    AND p.role = 'coach'
    AND (
      p.plan_actual IS NULL
      OR p.plan_actual = plan_id
      OR public.normalize_plan_key_for_chat(p.plan_actual) = plan_id
    )
  ))
  OR
  (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      p.plan_actual = plan_id
      OR public.normalize_plan_key_for_chat(p.plan_actual) = plan_id
    )
  ))
  OR
  (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.plan_actual = 'all_access'))
  OR
  (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND public.normalize_plan_key_for_chat(p.plan_actual) = 'all_access'
  ))
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
      OR (
        p.role = 'coach'
        AND (
          p.plan_actual IS NULL
          OR p.plan_actual = c.plan_id
          OR public.normalize_plan_key_for_chat(p.plan_actual) = c.plan_id
        )
      )
      OR p.plan_actual = c.plan_id
      OR public.normalize_plan_key_for_chat(p.plan_actual) = c.plan_id
      OR p.plan_actual = 'all_access'
      OR public.normalize_plan_key_for_chat(p.plan_actual) = 'all_access'
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
      OR (
        p.role = 'coach'
        AND (
          p.plan_actual IS NULL
          OR p.plan_actual = c.plan_id
          OR public.normalize_plan_key_for_chat(p.plan_actual) = c.plan_id
        )
      )
      OR p.plan_actual = c.plan_id
      OR public.normalize_plan_key_for_chat(p.plan_actual) = c.plan_id
      OR p.plan_actual = 'all_access'
      OR public.normalize_plan_key_for_chat(p.plan_actual) = 'all_access'
    )
  )
);
