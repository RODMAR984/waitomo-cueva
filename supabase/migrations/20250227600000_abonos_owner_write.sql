-- Org owner puede INSERT/UPDATE/DELETE abonos de su organización

CREATE POLICY "Org owner can insert abonos"
ON public.abonos FOR INSERT TO authenticated
WITH CHECK (
  organization_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
);

CREATE POLICY "Org owner can update abonos"
ON public.abonos FOR UPDATE TO authenticated
USING (
  organization_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
)
WITH CHECK (
  organization_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
);

CREATE POLICY "Org owner can delete abonos"
ON public.abonos FOR DELETE TO authenticated
USING (
  organization_id IN (SELECT id FROM public.organizations WHERE owner_id = auth.uid())
);
