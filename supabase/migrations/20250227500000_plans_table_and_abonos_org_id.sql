-- =============================================================================
-- FASE 3 — Planes dinámicos: tabla plans + organization_id en abonos
-- Waitomo no se desarma: mismo contenido, solo la fuente pasa a Supabase.
-- Cada org (o coach) podrá después armar sus planes desde AdminPlanes/AdminAbonos.
-- =============================================================================

-- 1) Tabla plans (una fila por plan por organización; code = id lógico para abonos.plan_id)
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  subtitle text,
  description text,
  image_url text,
  mode text NOT NULL DEFAULT 'class' CHECK (mode IN ('class', 'program')),
  active boolean NOT NULL DEFAULT true,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- Si plans ya existía sin organization_id (ej. migración previa), añadir columna y rellenar
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.plans p
SET organization_id = (SELECT id FROM public.organizations WHERE name = 'Waitomo Training' LIMIT 1)
WHERE p.organization_id IS NULL;

-- Columnas que puede no tener la tabla plans si existía con otro esquema
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS code text DEFAULT '';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS title text DEFAULT '';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS mode text DEFAULT 'class';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS "order" integer DEFAULT 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_plans_organization_id
ON public.plans (organization_id);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read plans of own org"
ON public.plans FOR SELECT TO authenticated
USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
);

CREATE POLICY "Org owner can manage plans"
ON public.plans FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
);

-- 2) Seed Waitomo: los 9 planes actuales (idempotente: solo si no existen ya)
INSERT INTO public.plans (organization_id, code, title, subtitle, mode, active, "order")
SELECT o.id, v.code, v.title, v.subtitle, v.mode, true, v.ord
FROM public.organizations o,
(VALUES
  ('cross', 'CROSS TRAINING', 'Clases grupales para todos', 'class', 1),
  ('oly', 'OLY', 'Levantamiento olímpico', 'class', 2),
  ('openbox', 'OPEN BOX', '+ Plani (opcional)', 'class', 3),
  ('stretching', 'STRETCHING', 'Movilidad y descarga', 'class', 4),
  ('evolucion', 'CICLO EVOLUCIÓN', 'Elegís tu actividad y la planificamos sin clases', 'program', 5),
  ('yoga', 'YOGA', 'Yoga y movilidad', 'class', 6),
  ('hyrox', 'HYROX', 'Alta intensidad + resistencia', 'class', 7),
  ('all_access', 'PASE LIBRE', 'Acceso a todos los planes', 'class', 8),
  ('pase_total', 'PASE TOTAL', 'Acceso ilimitado a todo el club', 'class', 9)
) AS v(code, title, subtitle, mode, ord)
WHERE o.name = 'Waitomo Training'
  AND NOT EXISTS (
    SELECT 1 FROM public.plans p2
    WHERE p2.organization_id = o.id AND p2.code = v.code
  );

-- 3) organization_id en abonos (compatibilidad: plan_id sigue siendo text)
ALTER TABLE public.abonos
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_abonos_organization_id ON public.abonos (organization_id);

UPDATE public.abonos a
SET organization_id = (SELECT id FROM public.organizations WHERE name = 'Waitomo Training' LIMIT 1)
WHERE a.organization_id IS NULL;

-- 4) RLS abonos: solo ver abonos de la propia organización
DROP POLICY IF EXISTS "Abonos public read" ON public.abonos;

CREATE POLICY "Users read abonos of own org"
ON public.abonos FOR SELECT TO authenticated
USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
  OR organization_id IS NULL
);

CREATE POLICY "Service role full abonos"
ON public.abonos FOR ALL TO service_role
USING (true) WITH CHECK (true);
