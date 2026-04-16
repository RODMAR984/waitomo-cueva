-- Mensajes del feed embebido en Trabajo del día (plan / día / global staff).
-- Sustituye la persistencia solo-local (tdc_chat) por datos en servidor por sede.

CREATE TABLE IF NOT EXISTS public.trabajo_dia_feed_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feed_kind text NOT NULL CHECK (feed_kind IN ('global', 'plan', 'day')),
  plan_key text,
  session_date date,
  slot_label text,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_msg_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, client_msg_id)
);

CREATE INDEX IF NOT EXISTS idx_trabajo_dia_feed_org_created
  ON public.trabajo_dia_feed_messages (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trabajo_dia_feed_lookup
  ON public.trabajo_dia_feed_messages (organization_id, feed_kind, plan_key, session_date);

ALTER TABLE public.trabajo_dia_feed_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trabajo_feed read org members" ON public.trabajo_dia_feed_messages;
CREATE POLICY "trabajo_feed read org members"
ON public.trabajo_dia_feed_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.organization_id IS NOT NULL
      AND p.organization_id = trabajo_dia_feed_messages.organization_id
  )
);

DROP POLICY IF EXISTS "trabajo_feed insert" ON public.trabajo_dia_feed_messages;
CREATE POLICY "trabajo_feed insert"
ON public.trabajo_dia_feed_messages
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.organization_id IS NOT NULL
      AND p.organization_id = trabajo_dia_feed_messages.organization_id
  )
  AND (
    feed_kind <> 'global'
    OR public.user_is_active_org_staff(trabajo_dia_feed_messages.organization_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
);

DROP POLICY IF EXISTS "trabajo_feed delete own or staff" ON public.trabajo_dia_feed_messages;
CREATE POLICY "trabajo_feed delete own or staff"
ON public.trabajo_dia_feed_messages
FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  OR public.user_is_active_org_staff(trabajo_dia_feed_messages.organization_id)
);

COMMENT ON TABLE public.trabajo_dia_feed_messages IS
  'Feed de chat embebido en Trabajo del día; payload replica el objeto que guardaba tdc_chat.';
