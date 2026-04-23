-- Estado y vencimiento del apto médico por usuario.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS apto_medico_uploaded_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS apto_medico_expires_at timestamptz;

-- Backfill inicial: si ya tenían apto marcado, asumimos vigencia anual desde hoy.
UPDATE public.profiles
SET
  apto_medico_uploaded_at = coalesce(apto_medico_uploaded_at, now()),
  apto_medico_expires_at = coalesce(apto_medico_expires_at, now() + interval '365 days')
WHERE coalesce(trim(apto_medico_url), '') <> '';

COMMENT ON COLUMN public.profiles.apto_medico_uploaded_at IS
  'Fecha/hora de carga del apto médico.';

COMMENT ON COLUMN public.profiles.apto_medico_expires_at IS
  'Fecha/hora de vencimiento del apto médico.';

