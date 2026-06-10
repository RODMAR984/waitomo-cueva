-- ID público del vendedor MP (sin secretos) para mostrar en admin.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS mercadopago_mp_user_id text;

COMMENT ON COLUMN public.organizations.mercadopago_mp_user_id IS
  'user_id de Mercado Pago del vendedor OAuth; solo lectura en UI, sin tokens.';

UPDATE public.organizations o
SET mercadopago_mp_user_id = c.mp_user_id
FROM public.mercadopago_org_credentials c
WHERE c.organization_id = o.id
  AND c.mp_user_id IS NOT NULL
  AND (o.mercadopago_mp_user_id IS NULL OR o.mercadopago_mp_user_id = '');
