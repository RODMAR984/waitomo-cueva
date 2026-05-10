-- RLS explícita en credenciales MP (cierra lint "RLS enabled no policy"); catálogo de badges; endurece RPC staff_* vs rol anon.
-- service_role sigue bypassing RLS en credenciales (Edge Functions).

-- 1) mercadopago_org_credentials: sin acceso JWT directo (solo service_role / backend)
DROP POLICY IF EXISTS mercadopago_org_credentials_block_authenticated ON public.mercadopago_org_credentials;
DROP POLICY IF EXISTS mercadopago_org_credentials_block_anon ON public.mercadopago_org_credentials;

CREATE POLICY mercadopago_org_credentials_block_authenticated
  ON public.mercadopago_org_credentials
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY mercadopago_org_credentials_block_anon
  ON public.mercadopago_org_credentials
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.mercadopago_org_credentials IS
  'OAuth MP por org. JWT (anon/authenticated) sin acceso directo; Edge con service_role.';

-- 2) badge_definitions: catálogo de lectura para clientes autenticados
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS badge_definitions_select_authenticated ON public.badge_definitions;
CREATE POLICY badge_definitions_select_authenticated
  ON public.badge_definitions
  FOR SELECT
  TO authenticated
  USING (true);

-- 3) Quitar EXECUTE a anon en RPC staff_* (mitiga vector si el cuerpo asume JWT y el linter advierte anon+SECURITY DEFINER)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS proc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'staff\_%' ESCAPE '\'
      AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.proc);
  END LOOP;
END $$;
