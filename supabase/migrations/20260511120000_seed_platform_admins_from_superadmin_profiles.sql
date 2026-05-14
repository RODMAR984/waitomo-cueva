-- Alinea `platform_admins` con legado `profiles.role = superadmin` (roadmap: seed fundador / operadores).
-- Idempotente: re-ejecutar solo refuerza active=true.

INSERT INTO public.platform_admins (user_id, active, notes)
SELECT p.id,
  true,
  'sync_from_profiles_role_superadmin'
FROM public.profiles p
WHERE lower(trim(coalesce(p.role, ''))) = 'superadmin'
ON CONFLICT (user_id) DO UPDATE
SET active = true,
  notes = EXCLUDED.notes;
