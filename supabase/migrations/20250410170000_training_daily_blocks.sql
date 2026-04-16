-- Rutinas del día (bloques coach) multi-tenant: fuente de verdad en servidor por org / plan / coach.
-- La app sigue usando AsyncStorage como caché; sync push/pull desde TrainingDataContext.

CREATE TABLE IF NOT EXISTS public.training_daily_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_key text NOT NULL,
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  slot_label text NOT NULL,
  titulo text NOT NULL DEFAULT '',
  contenido text NOT NULL DEFAULT '',
  notas text NOT NULL DEFAULT '',
  video_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  rm_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  client_block_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, client_block_id)
);

CREATE INDEX IF NOT EXISTS idx_training_daily_blocks_org_fecha
  ON public.training_daily_blocks (organization_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_training_daily_blocks_org_plan_fecha
  ON public.training_daily_blocks (organization_id, plan_key, fecha DESC);

CREATE OR REPLACE FUNCTION public.training_daily_blocks_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_training_daily_blocks_updated ON public.training_daily_blocks;
CREATE TRIGGER trg_training_daily_blocks_updated
  BEFORE UPDATE ON public.training_daily_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.training_daily_blocks_set_updated_at();

ALTER TABLE public.training_daily_blocks ENABLE ROW LEVEL SECURITY;

-- Lectura: superadmin, staff de la org, o socio de la misma org cuyo plan puede ver el canal (misma lógica que chat)
DROP POLICY IF EXISTS "training_blocks superadmin read" ON public.training_daily_blocks;
CREATE POLICY "training_blocks superadmin read"
ON public.training_daily_blocks
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
);

DROP POLICY IF EXISTS "training_blocks staff read" ON public.training_daily_blocks;
CREATE POLICY "training_blocks staff read"
ON public.training_daily_blocks
FOR SELECT
TO authenticated
USING (public.user_is_active_org_staff(organization_id));

DROP POLICY IF EXISTS "training_blocks members read by plan" ON public.training_daily_blocks;
CREATE POLICY "training_blocks members read by plan"
ON public.training_daily_blocks
FOR SELECT
TO authenticated
USING (
  NOT public.user_is_active_org_staff(training_daily_blocks.organization_id)
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.organization_id IS NOT NULL
      AND p.organization_id = training_daily_blocks.organization_id
      AND (
        public.normalize_plan_key_for_chat(p.plan_actual) = training_daily_blocks.plan_key
        OR public.normalize_plan_key_for_chat(p.plan_actual) = 'all_access'
        OR p.plan_actual = training_daily_blocks.plan_key
      )
  )
);

-- Escritura: solo staff de la org (memberships)
DROP POLICY IF EXISTS "training_blocks staff insert" ON public.training_daily_blocks;
CREATE POLICY "training_blocks staff insert"
ON public.training_daily_blocks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  OR (
    coach_id = auth.uid()
    AND public.user_is_active_org_staff(organization_id)
  )
);

DROP POLICY IF EXISTS "training_blocks staff update" ON public.training_daily_blocks;
CREATE POLICY "training_blocks staff update"
ON public.training_daily_blocks
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  OR (
    public.user_is_active_org_staff(organization_id)
    AND (
      coach_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.organization_id = training_daily_blocks.organization_id
          AND p.role IN ('admin', 'superadmin')
      )
    )
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  OR (
    public.user_is_active_org_staff(organization_id)
    AND (
      coach_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.organization_id = training_daily_blocks.organization_id
          AND p.role IN ('admin', 'superadmin')
      )
    )
  )
);

DROP POLICY IF EXISTS "training_blocks staff delete" ON public.training_daily_blocks;
CREATE POLICY "training_blocks staff delete"
ON public.training_daily_blocks
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  OR (
    public.user_is_active_org_staff(organization_id)
    AND (
      coach_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.organization_id = training_daily_blocks.organization_id
          AND p.role IN ('admin', 'superadmin')
      )
    )
  )
);

COMMENT ON TABLE public.training_daily_blocks IS
  'Bloques de rutina por sede/plan/día; client_block_id es el id estable generado en la app (tdc_bloques).';
