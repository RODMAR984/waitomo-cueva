-- Nuevos usuarios no heredan la org seed (Waitomo Training).
-- Clientes eligen centro en WelcomeClientJoin o con código de invitación.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, organization_id)
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
    ),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Crea profile sin organization_id; gym/coach se asigna en onboarding o join con código.';
