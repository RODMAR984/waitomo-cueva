-- Distingue "OAuth guardado" vs "checkout MP activo" (igual idea que Stripe: cuenta + toggle).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS mercadopago_oauth_linked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.mercadopago_oauth_linked IS 'True si hay fila en mercadopago_org_credentials; el toggle mercadopago_checkout_enabled controla si se usa en checkout.';

UPDATE public.organizations o
SET mercadopago_oauth_linked = true
WHERE EXISTS (
  SELECT 1 FROM public.mercadopago_org_credentials c WHERE c.organization_id = o.id
);

UPDATE public.organizations o
SET mercadopago_checkout_enabled = false
WHERE mercadopago_oauth_linked = false AND mercadopago_checkout_enabled = true;
