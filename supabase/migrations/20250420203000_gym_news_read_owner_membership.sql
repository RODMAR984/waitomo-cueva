-- Novedades (gym_news): leer activas si sos dueño de la org o staff en memberships,
-- aunque profiles.organization_id sea otra sede (doble rol cliente + dueño/coach).

DROP POLICY IF EXISTS "Members read active news for their org" ON public.gym_news;

CREATE POLICY "Members read active news for their org"
ON public.gym_news
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'superadmin'
    )
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = gym_news.organization_id
        AND o.owner_id IS NOT NULL
        AND o.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = gym_news.organization_id
        AND m.user_id = auth.uid()
        AND m.active = true
        AND lower(trim(m.role)) IN ('owner', 'admin', 'coach', 'superadmin')
    )
    OR (
      public.user_has_org_community_entitlement(gym_news.organization_id, NULL::text)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.organization_id IS NOT NULL
          AND p.organization_id = gym_news.organization_id
      )
    )
  )
);
