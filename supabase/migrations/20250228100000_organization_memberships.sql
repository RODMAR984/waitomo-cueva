-- Modelo serio multi-tenant: una persona puede tener múltiples roles en múltiples orgs.
-- Fuente de verdad para contexto (cliente/staff) y routing por organización.

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('cliente', 'coach', 'admin', 'superadmin', 'owner')),
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, role)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.organization_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON public.organization_memberships (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_active ON public.organization_memberships (active) WHERE active = true;

ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own memberships" ON public.organization_memberships;
CREATE POLICY "Users read own memberships"
ON public.organization_memberships
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own memberships" ON public.organization_memberships;
CREATE POLICY "Users manage own memberships"
ON public.organization_memberships
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Backfill mínimo desde profile actual
INSERT INTO public.organization_memberships (user_id, organization_id, role, active, is_default)
SELECT
  p.id,
  p.organization_id,
  CASE
    WHEN p.role IN ('coach', 'admin', 'superadmin') THEN p.role
    ELSE 'cliente'
  END AS role,
  true,
  true
FROM public.profiles p
WHERE p.organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id, role) DO NOTHING;

-- Backfill staff owner
INSERT INTO public.organization_memberships (user_id, organization_id, role, active, is_default)
SELECT
  o.owner_id,
  o.id,
  'owner',
  true,
  false
FROM public.organizations o
WHERE o.owner_id IS NOT NULL
ON CONFLICT (user_id, organization_id, role) DO NOTHING;

