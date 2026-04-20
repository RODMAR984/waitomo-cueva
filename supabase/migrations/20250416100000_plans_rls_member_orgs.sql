-- Permitir leer planes de cualquier organización donde el usuario tenga membresía activa,
-- no solo la fila única profiles.organization_id (clientes invitados / dual org).

DROP POLICY IF EXISTS "Users read plans of own org" ON public.plans;
-- Idempotente: si ya se aplicó antes, volver a correr el SQL no falla (42710).
DROP POLICY IF EXISTS "Users read plans of member orgs" ON public.plans;

CREATE POLICY "Users read plans of member orgs"
ON public.plans FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.organization_id = plans.organization_id
  )
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.user_id = auth.uid()
      AND m.organization_id = plans.organization_id
      AND m.active = true
  )
);
