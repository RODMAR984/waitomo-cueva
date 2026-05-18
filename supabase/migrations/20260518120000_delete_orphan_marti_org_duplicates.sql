-- Borradores vacíos de onboarding Marti (intentos / typos). Conservar la org real con datos.
-- Org buena: "Marti tu coach hot" (martina@codaspaces.com owner, miembros, planes, branding).

DELETE FROM public.organizations o
WHERE lower(trim(o.name)) LIKE '%marti%'
  AND o.id <> 'bda5a9a9-ba3c-4fda-8b4c-4820d8624db0'
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_memberships m WHERE m.organization_id = o.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.organization_id = o.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.plans pl WHERE pl.organization_id = o.id
  );
