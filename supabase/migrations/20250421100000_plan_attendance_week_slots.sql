-- Política de asistencia por plan + cupo por defecto + franjas recurrentes (día semana + hora).
-- Fase 1: datos para admin; reservas reales (class_bookings) en migración posterior.

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS attendance_policy text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS default_capacity integer;

UPDATE public.plans
SET attendance_policy = CASE WHEN mode = 'program' THEN 'not_applicable' ELSE 'dropin' END
WHERE attendance_policy IS NULL;

ALTER TABLE public.plans ALTER COLUMN attendance_policy SET DEFAULT 'dropin';
ALTER TABLE public.plans ALTER COLUMN attendance_policy SET NOT NULL;

ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_attendance_policy_check;
ALTER TABLE public.plans
  ADD CONSTRAINT plans_attendance_policy_check
  CHECK (attendance_policy IN ('booking_required', 'dropin', 'dropin_capped', 'not_applicable'));

ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_default_capacity_check;
ALTER TABLE public.plans
  ADD CONSTRAINT plans_default_capacity_check
  CHECK (default_capacity IS NULL OR (default_capacity > 0 AND default_capacity <= 500));

COMMENT ON COLUMN public.plans.attendance_policy IS 'not_applicable=programa remoto; booking_required=cupo+reserva; dropin=solo rutina sin cupo app; dropin_capped=cupo sin reserva obligatoria (fase UI).';
COMMENT ON COLUMN public.plans.default_capacity IS 'Cupo sugerido por defecto para bloques de este plan (override en training_daily_blocks en fase posterior).';

-- weekday: 1=lunes … 7=domingo (ISO-like, coherente con agenda en español)
CREATE TABLE IF NOT EXISTS public.plan_week_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_code text NOT NULL,
  weekday smallint NOT NULL CHECK (weekday >= 1 AND weekday <= 7),
  slot_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_week_slots_slot_trim CHECK (char_length(trim(slot_label)) > 0),
  UNIQUE (organization_id, plan_code, weekday, slot_label)
);

CREATE INDEX IF NOT EXISTS idx_plan_week_slots_org ON public.plan_week_slots (organization_id);
CREATE INDEX IF NOT EXISTS idx_plan_week_slots_plan ON public.plan_week_slots (organization_id, plan_code);

ALTER TABLE public.plan_week_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_week_slots read member orgs" ON public.plan_week_slots;
CREATE POLICY "plan_week_slots read member orgs"
ON public.plan_week_slots FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.organization_id = plan_week_slots.organization_id
  )
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = plan_week_slots.organization_id
      AND m.active = true
  )
);

DROP POLICY IF EXISTS "plan_week_slots owner write" ON public.plan_week_slots;
CREATE POLICY "plan_week_slots owner write"
ON public.plan_week_slots FOR ALL TO authenticated
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
