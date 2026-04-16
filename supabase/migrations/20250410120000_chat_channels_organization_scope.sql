-- Chat multi-tenant: cada organización tiene sus propios canales y mensajes.
-- Antes: UNIQUE(plan_id) global → una org nueva veía mensajes de Waitomo u otras.

-- 1) Columna + backfill legado → Waitomo
ALTER TABLE public.chat_channels
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.chat_channels c
SET organization_id = (
  SELECT id FROM public.organizations WHERE name = 'Waitomo Training' LIMIT 1
)
WHERE c.organization_id IS NULL;

-- Si no existe fila Waitomo, usar la org más antigua (evita NULL)
UPDATE public.chat_channels c
SET organization_id = (SELECT id FROM public.organizations ORDER BY created_at ASC NULLS LAST LIMIT 1)
WHERE c.organization_id IS NULL;

ALTER TABLE public.chat_channels
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.chat_channels DROP CONSTRAINT IF EXISTS chat_channels_plan_id_key;

ALTER TABLE public.chat_channels
  ADD CONSTRAINT chat_channels_organization_id_plan_id_key UNIQUE (organization_id, plan_id);

CREATE INDEX IF NOT EXISTS idx_chat_channels_organization_id ON public.chat_channels (organization_id);

-- 2) Sembrar canales para cada org que aún no tenga (org nueva = chat vacío)
INSERT INTO public.chat_channels (organization_id, plan_id, name)
SELECT o.id, v.plan_id, v.name
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('cross', 'Cross Training'),
    ('yoga', 'Yoga'),
    ('openbox', 'Open Box'),
    ('evolucion', 'Ciclo Evolución'),
    ('stretching', 'Stretching'),
    ('oly', 'OLY'),
    ('hyrox', 'Hyrox'),
    ('all_access', 'Pase libre / todos los planes')
) AS v(plan_id, name)
ON CONFLICT (organization_id, plan_id) DO NOTHING;

-- 3) Nuevas organizaciones: canales por defecto
CREATE OR REPLACE FUNCTION public.seed_chat_channels_for_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.chat_channels (organization_id, plan_id, name)
  VALUES
    (NEW.id, 'cross', 'Cross Training'),
    (NEW.id, 'yoga', 'Yoga'),
    (NEW.id, 'openbox', 'Open Box'),
    (NEW.id, 'evolucion', 'Ciclo Evolución'),
    (NEW.id, 'stretching', 'Stretching'),
    (NEW.id, 'oly', 'OLY'),
    (NEW.id, 'hyrox', 'Hyrox'),
    (NEW.id, 'all_access', 'Pase libre / todos los planes')
  ON CONFLICT (organization_id, plan_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_seed_chat_channels ON public.organizations;
CREATE TRIGGER trg_organizations_seed_chat_channels
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_chat_channels_for_organization();

-- 4) RLS: solo canales de la misma org que profiles.organization_id (superadmin ve todo)
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
          p.role IN ('admin', 'superadmin')
          OR (
            p.role = 'coach'
            AND (
              p.plan_actual IS NULL
              OR p.plan_actual = chat_channels.plan_id
              OR public.normalize_plan_key_for_chat(p.plan_actual) = chat_channels.plan_id
            )
          )
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

DROP POLICY IF EXISTS "Admins can manage channels" ON public.chat_channels;

CREATE POLICY "Admins can manage channels"
ON public.chat_channels
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'superadmin'
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'superadmin')
    AND p.organization_id IS NOT NULL
    AND p.organization_id = chat_channels.organization_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'superadmin'
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'superadmin')
    AND p.organization_id IS NOT NULL
    AND p.organization_id = chat_channels.organization_id
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
          p.role IN ('admin', 'superadmin')
          OR (
            p.role = 'coach'
            AND (
              p.plan_actual IS NULL
              OR p.plan_actual = c.plan_id
              OR public.normalize_plan_key_for_chat(p.plan_actual) = c.plan_id
            )
          )
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
          p.role IN ('admin', 'superadmin')
          OR (
            p.role = 'coach'
            AND (
              p.plan_actual IS NULL
              OR p.plan_actual = c.plan_id
              OR public.normalize_plan_key_for_chat(p.plan_actual) = c.plan_id
            )
          )
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
