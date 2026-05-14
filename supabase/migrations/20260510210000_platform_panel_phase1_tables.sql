-- Fase 1 panel plataforma: auditoría, flags, soporte, vista orgs + SELECT global organizations para is_platform_admin().
-- Prerrequisito embebido: si solo corrés este archivo (p. ej. SQL Editor), aquí se aseguran `platform_admins` e
-- `is_platform_admin()`. Si ya aplicaste 20260510120000, este bloque es idempotente (IF NOT EXISTS / OR REPLACE).

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  notes text,
  active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_active_true
  ON public.platform_admins (user_id)
  WHERE active = true;

COMMENT ON TABLE public.platform_admins IS
  'Admins de la plataforma FitEngine (no confundir con owner de una org). La app usa fila active=true; grants vía SQL/Supabase Studio.';

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admins select own row" ON public.platform_admins;
CREATE POLICY "platform_admins select own row"
ON public.platform_admins
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid()
      AND COALESCE(pa.active, false) = true
  );
$$;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'True si auth.uid() tiene fila activa en platform_admins. SECURITY DEFINER + search_path fijo (roadmap).';

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO service_role;

-- ---------------------------------------------------------------------------
-- platform_audit_log (append-only lógico vía políticas)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_created_at ON public.platform_audit_log (created_at DESC);

COMMENT ON TABLE public.platform_audit_log IS 'Acciones auditadas del panel plataforma; INSERT reservado a admins de plataforma.';

ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_audit_log_select ON public.platform_audit_log;
CREATE POLICY platform_audit_log_select
ON public.platform_audit_log FOR SELECT TO authenticated
USING (public.is_platform_admin());

DROP POLICY IF EXISTS platform_audit_log_insert ON public.platform_audit_log;
CREATE POLICY platform_audit_log_insert
ON public.platform_audit_log FOR INSERT TO authenticated
WITH CHECK (
  public.is_platform_admin()
  AND (actor_id IS NULL OR actor_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- platform_feature_flags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_feature_flags (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.platform_feature_flags IS 'Flags globales FitEngine; escritura solo admins de plataforma.';

ALTER TABLE public.platform_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_feature_flags_select ON public.platform_feature_flags;
CREATE POLICY platform_feature_flags_select
ON public.platform_feature_flags FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS platform_feature_flags_insert ON public.platform_feature_flags;
CREATE POLICY platform_feature_flags_insert
ON public.platform_feature_flags FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS platform_feature_flags_update ON public.platform_feature_flags;
CREATE POLICY platform_feature_flags_update
ON public.platform_feature_flags FOR UPDATE TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS platform_feature_flags_delete ON public.platform_feature_flags;
CREATE POLICY platform_feature_flags_delete
ON public.platform_feature_flags FOR DELETE TO authenticated
USING (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- support_tickets + support_ticket_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  subject text NOT NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON public.support_tickets (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_author ON public.support_tickets (created_by, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.support_ticket_org_staff(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.support_tickets t
    INNER JOIN public.organization_memberships m
      ON m.organization_id = t.organization_id
     AND m.user_id = auth.uid()
     AND m.active = true
     AND m.role IN ('coach', 'admin', 'owner', 'superadmin')
    WHERE t.id = p_ticket_id
  );
$$;

REVOKE ALL ON FUNCTION public.support_ticket_org_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.support_ticket_org_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.support_ticket_org_staff(uuid) TO service_role;

DROP POLICY IF EXISTS support_tickets_select ON public.support_tickets;
CREATE POLICY support_tickets_select
ON public.support_tickets FOR SELECT TO authenticated
USING (
  public.is_platform_admin()
  OR created_by = auth.uid()
  OR public.support_ticket_org_staff(id)
);

DROP POLICY IF EXISTS support_tickets_insert ON public.support_tickets;
CREATE POLICY support_tickets_insert
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.is_platform_admin()
    OR public.support_ticket_org_staff(id)
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.organization_id = support_tickets.organization_id
        AND m.user_id = auth.uid()
        AND m.active = true
    )
  )
);

DROP POLICY IF EXISTS support_tickets_update ON public.support_tickets;
CREATE POLICY support_tickets_update
ON public.support_tickets FOR UPDATE TO authenticated
USING (
  public.is_platform_admin()
  OR created_by = auth.uid()
  OR public.support_ticket_org_staff(id)
)
WITH CHECK (
  public.is_platform_admin()
  OR created_by = auth.uid()
  OR public.support_ticket_org_staff(id)
);

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON public.support_ticket_messages (ticket_id, created_at);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_ticket_messages_select ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_select
ON public.support_ticket_messages FOR SELECT TO authenticated
USING (
  public.is_platform_admin()
  OR author_id = auth.uid()
  OR public.support_ticket_org_staff(ticket_id)
  OR EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND t.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS support_ticket_messages_insert ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_insert
ON public.support_ticket_messages FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.is_platform_admin()
    OR public.support_ticket_org_staff(ticket_id)
    OR EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.created_by = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- organizations: lectura global para admins de plataforma (vista overview)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS organizations_select_platform_admin ON public.organizations;
CREATE POLICY organizations_select_platform_admin
ON public.organizations FOR SELECT TO authenticated
USING (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Vista agregada (sin MRR; columnas alineadas al schema actual)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.platform_orgs_overview AS
SELECT
  o.id AS organization_id,
  o.name,
  o.type,
  o.active,
  o.plan_fitengine,
  o.owner_id,
  o.created_at,
  (
    SELECT COUNT(*)::bigint
    FROM public.organization_memberships m
    WHERE m.organization_id = o.id
      AND m.active = true
      AND m.role = 'cliente'
  ) AS client_memberships_count,
  (
    SELECT COUNT(*)::bigint
    FROM public.organization_memberships m
    WHERE m.organization_id = o.id
      AND m.active = true
      AND m.role IN ('coach', 'admin', 'owner', 'superadmin')
  ) AS staff_memberships_count
FROM public.organizations o;

COMMENT ON VIEW public.platform_orgs_overview IS 'Resumen multi-org para panel plataforma; respeta RLS de organizations.';
