-- =============================================================================
-- IMPORTANTE: Pegá SOLO este archivo. No pegues texto tipo "Lógica Caja Novedades"
-- ni descripciones; solo líneas que empiecen con -- o con CREATE/ALTER/INSERT etc.
-- =============================================================================
-- 1) NOVEDADES (gym_news) — Caja en ClientScreen + NovedadesScreen
-- =============================================================================
-- Ejecutá en Supabase: SQL Editor → New query → Pegar este archivo completo → Run
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gym_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  image_url text,
  tag text,
  is_active boolean NOT NULL DEFAULT true,
  pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gym_news ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado ve noticias activas
CREATE POLICY "Authenticated can read active news"
ON public.gym_news
FOR SELECT
TO authenticated
USING (is_active = true);

-- Escritura: solo admin/superadmin (vía profiles.role)
CREATE POLICY "Admins can insert news"
ON public.gym_news
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Admins can update news"
ON public.gym_news
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin')
  )
);

-- Índices para la query típica (preview y lista)
CREATE INDEX IF NOT EXISTS idx_gym_news_active_pinned_created
ON public.gym_news (is_active, pinned DESC, created_at DESC)
WHERE is_active = true;


-- =============================================================================
-- 2) CHAT — Un canal por plan; usuarios + coach del plan + admin ven cada canal
-- =============================================================================
-- Canales: uno por plan_id (cross, yoga, etc.). name = nombre para mostrar.
-- Acceso: usuario ve canal de su plan_actual; coach ve canal de su plan; admin ve todos.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

-- Usuario puede leer canal si: es admin, o es coach con ese plan, o es cliente con plan_actual = plan_id
CREATE POLICY "Users can read channel by role and plan"
ON public.chat_channels
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin'))
  OR
  (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'coach' AND (p.plan_actual = plan_id OR p.plan_actual IS NULL)))
  OR
  (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.plan_actual = plan_id))
);

-- Solo admin puede crear/actualizar canales (se crean una vez por plan)
CREATE POLICY "Admins can manage channels"
ON public.chat_channels
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'superadmin'))
);


CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Leer mensajes: mismo criterio que leer el canal (quien ve el canal ve sus mensajes)
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
    )
  )
);

-- Escribir: quien puede leer el canal puede escribir (admin, coach del plan, usuario del plan)
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
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created
ON public.chat_messages (channel_id, created_at DESC);


-- =============================================================================
-- SEED OPCIONAL: canales por plan (ejecutar una vez si querés canales precreados)
-- =============================================================================
-- INSERT INTO public.chat_channels (plan_id, name) VALUES
--   ('cross', 'Cross Training'),
--   ('yoga', 'Yoga'),
--   ('openbox', 'Open Box'),
--   ('evolucion', 'Evolución'),
--   ('stretching', 'Stretching'),
--   ('oly', 'OLY'),
--   ('hyrox', 'Hyrox')
-- ON CONFLICT (plan_id) DO NOTHING;
