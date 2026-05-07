-- Mercado Pago por organización (OAuth vendedor). Tokens solo vía service_role / Edge Functions.

CREATE TABLE IF NOT EXISTS public.mercadopago_org_credentials (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  mp_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mercadopago_org_credentials ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.mercadopago_org_credentials IS 'OAuth MP por org; sin políticas RLS para roles JWT = solo service_role.';

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS mercadopago_checkout_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.mercadopago_checkout_enabled IS 'True si el dueño conectó MP OAuth; checkout usa token de esta tabla.';

CREATE OR REPLACE FUNCTION public.mercadopago_org_credentials_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mercadopago_org_credentials_updated ON public.mercadopago_org_credentials;
CREATE TRIGGER trg_mercadopago_org_credentials_updated
  BEFORE UPDATE ON public.mercadopago_org_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.mercadopago_org_credentials_set_updated_at();
