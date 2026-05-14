-- martina@codaspaces.com: sin staff en Waitomo; solo dueña de "Marti tu coach hot" con su branding.
-- Idempotente: segunda ejecución no borra la membresía owner.
--
-- Nota: `profiles.role` tiene CHECK (cliente|coach|admin|superadmin); no existe 'owner' en profiles.
-- La dueña del gym sigue siendo `organization_memberships.role = 'owner'` (no tocamos profiles.role).

DELETE FROM public.organization_memberships m
USING auth.users u, public.organizations o
WHERE m.user_id = u.id
  AND m.organization_id = o.id
  AND lower(trim(u.email)) = 'martina@codaspaces.com'
  AND (
    o.name = 'Waitomo Training'
    OR (
      m.role = 'coach'
      AND EXISTS (
        SELECT 1
        FROM public.organization_memberships m2
        WHERE m2.user_id = m.user_id
          AND m2.organization_id = m.organization_id
          AND m2.role = 'owner'
      )
    )
  );
