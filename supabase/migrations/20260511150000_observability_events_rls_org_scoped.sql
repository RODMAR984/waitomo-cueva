-- Fase 6 — Hardening RLS de observability_events por organization_id
-- Objetivo: evitar lectura amplia para staff; cada rol staff ve eventos solo de sus orgs.
-- Plataforma (platform_admins / superadmin): puede ver todo.

DROP POLICY IF EXISTS observability_events_select_admin ON public.observability_events;

CREATE POLICY observability_events_select_admin
ON public.observability_events
FOR SELECT
USING (
  -- Admin de plataforma: lectura global.
  public.is_platform_admin()
  OR (
    -- Compatibilidad legado: perfiles.role='superadmin' (hasta que seed + platform_admins sea 100%).
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'superadmin'
    )
  )
  OR (
    -- Staff no-plataforma: solo eventos de organizaciones donde tiene membership activa.
    observability_events.organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_memberships sm
      WHERE sm.user_id = auth.uid()
        AND sm.organization_id = observability_events.organization_id
        AND sm.active = true
        AND sm.role IN ('owner', 'admin', 'coach', 'superadmin')
    )
  )
);

COMMENT ON POLICY observability_events_select_admin ON public.observability_events IS
  'Staff ve observability_events solo por organization_id (membership activa). Superadmin/plataforma ve global.';

