-- Cobros pendientes y suscripciones generadas desde Admin finanzas (antes solo AsyncStorage).

CREATE TABLE IF NOT EXISTS public.billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id text NOT NULL,
  plan_id text,
  periodo text,
  monto numeric NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'ARS',
  metodo text,
  status text NOT NULL DEFAULT 'pendiente',
  pagado_parcial numeric DEFAULT 0,
  paid_at timestamptz,
  last_partial_at timestamptz,
  refund_at timestamptz,
  refund_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_org_status
  ON public.billing_payments (organization_id, status);

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id text NOT NULL,
  plan_id text,
  tipo text DEFAULT 'mensual',
  precio numeric NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'ARS',
  dia_vencimiento int NOT NULL DEFAULT 5,
  activo boolean NOT NULL DEFAULT true,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_subs_org_activo
  ON public.billing_subscriptions (organization_id, activo);

CREATE OR REPLACE FUNCTION public.billing_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_payments_updated ON public.billing_payments;
CREATE TRIGGER trg_billing_payments_updated
  BEFORE UPDATE ON public.billing_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.billing_set_updated_at();

DROP TRIGGER IF EXISTS trg_billing_subs_updated ON public.billing_subscriptions;
CREATE TRIGGER trg_billing_subs_updated
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.billing_set_updated_at();

ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

-- Pagos: staff gestiona todo; socio ve lo suyo
DROP POLICY IF EXISTS "billing_payments staff all" ON public.billing_payments;
CREATE POLICY "billing_payments staff all"
ON public.billing_payments
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  OR public.user_is_active_org_staff(organization_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  OR public.user_is_active_org_staff(organization_id)
);

DROP POLICY IF EXISTS "billing_payments member read own" ON public.billing_payments;
CREATE POLICY "billing_payments member read own"
ON public.billing_payments
FOR SELECT
TO authenticated
USING (
  member_user_id IS NOT NULL
  AND member_user_id = auth.uid()
);

-- Suscripciones: mismo patrón
DROP POLICY IF EXISTS "billing_subs staff all" ON public.billing_subscriptions;
CREATE POLICY "billing_subs staff all"
ON public.billing_subscriptions
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  OR public.user_is_active_org_staff(organization_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  OR public.user_is_active_org_staff(organization_id)
);

DROP POLICY IF EXISTS "billing_subs member read own" ON public.billing_subscriptions;
CREATE POLICY "billing_subs member read own"
ON public.billing_subscriptions
FOR SELECT
TO authenticated
USING (
  member_user_id IS NOT NULL
  AND member_user_id = auth.uid()
);
