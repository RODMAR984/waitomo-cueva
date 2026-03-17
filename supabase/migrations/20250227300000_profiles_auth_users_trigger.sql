-- =============================================================================
-- FIX: profiles_id_fkey "Key is not present in table users"
-- profiles.id debe referenciar auth.users(id). Trigger para crear perfil al registrarse.
-- =============================================================================
-- Ejecutar en Supabase SQL Editor si db push no aplica.
-- =============================================================================

-- 1) Si profiles tiene FK a public.users, quitarla y apuntar a auth.users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'profiles'
    AND constraint_name = 'profiles_id_fkey'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2) Asegurar que profiles.id referencia auth.users(id)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3) Función: al crear usuario en auth, crear fila en profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      CASE WHEN (NEW.raw_user_meta_data->>'role') IN ('coach','admin','superadmin') THEN (NEW.raw_user_meta_data->>'role')::text END,
      'cliente'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'nombre',
      ''
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- 4) Trigger en auth.users (solo si no existe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5) Backfill: usuarios que ya están en auth.users pero no en profiles
INSERT INTO public.profiles (id, role, full_name)
SELECT u.id, 'cliente', COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
