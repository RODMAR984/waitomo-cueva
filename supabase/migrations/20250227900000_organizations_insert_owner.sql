-- Fase 6a: onboarding owner puede crear su organización (1 por usuario)
CREATE POLICY "Authenticated can insert own organization"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());
