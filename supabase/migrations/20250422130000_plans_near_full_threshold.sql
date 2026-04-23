-- Umbral configurable de "últimos lugares" por plan.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS near_full_threshold integer;

UPDATE public.plans
SET near_full_threshold = 2
WHERE near_full_threshold IS NULL
  AND coalesce(attendance_policy, 'dropin') IN ('booking_required', 'dropin_capped');

ALTER TABLE public.plans
  ALTER COLUMN near_full_threshold SET DEFAULT 2;

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_near_full_threshold_check;

ALTER TABLE public.plans
  ADD CONSTRAINT plans_near_full_threshold_check
  CHECK (near_full_threshold IS NULL OR (near_full_threshold >= 1 AND near_full_threshold <= 20));

COMMENT ON COLUMN public.plans.near_full_threshold IS
  'Cantidad de lugares restantes a partir de la cual el calendario muestra "últimos lugares".';

