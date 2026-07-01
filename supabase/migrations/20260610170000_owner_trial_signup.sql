-- Trial SaaS 14 días: columnas organizations + RPC signup_owner_with_trial + vista superadmin.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS activity_type text,
  ADD COLUMN IF NOT EXISTS business_model text,
  ADD COLUMN IF NOT EXISTS size_range text;

-- Orgs históricas sin trial_expires_at siguen activas (no heredan trial SaaS).
UPDATE public.organizations
SET subscription_status = 'active'
WHERE trial_expires_at IS NULL
  AND subscription_status IS DISTINCT FROM 'active';

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_subscription_status_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_subscription_status_check
  CHECK (subscription_status IN ('trial', 'active', 'expired', 'canceled', 'suspended'));

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_business_model_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_business_model_check
  CHECK (
    business_model IS NULL
    OR business_model IN ('gym_presential', 'coach_online', 'combined')
  );

CREATE INDEX IF NOT EXISTS organizations_trial_expires_idx
  ON public.organizations (trial_expires_at)
  WHERE subscription_status = 'trial';

COMMENT ON COLUMN public.organizations.trial_expires_at IS 'Fin del trial SaaS FitEngine (plataforma).';
COMMENT ON COLUMN public.organizations.subscription_status IS 'Estado comercial SaaS: trial, active, expired, canceled, suspended.';
COMMENT ON COLUMN public.organizations.business_model IS 'Modelo de negocio: gym_presential, coach_online, combined.';

CREATE OR REPLACE FUNCTION public.signup_owner_with_trial(
  p_org_name text,
  p_business_model text,
  p_country text,
  p_city text,
  p_size_range text,
  p_accent_color text DEFAULT '#86C4C7',
  p_activity_type text DEFAULT NULL,
  p_billing_currency text DEFAULT 'ARS',
  p_timezone text DEFAULT 'America/Argentina/Buenos_Aires'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_org_id uuid;
  v_trial_expires_at timestamptz;
  v_org_type text;
  v_name text;
  v_bm text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_name := trim(coalesce(p_org_name, ''));
  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'invalid_org_name';
  END IF;

  v_bm := lower(trim(coalesce(p_business_model, '')));
  IF v_bm NOT IN ('gym_presential', 'coach_online', 'combined') THEN
    RAISE EXCEPTION 'invalid_business_model';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    WHERE m.user_id = v_uid
      AND m.role = 'owner'
      AND m.active = true
  ) THEN
    RAISE EXCEPTION 'already_owner';
  END IF;

  v_org_type := CASE WHEN v_bm = 'coach_online' THEN 'coach' ELSE 'gym' END;
  v_trial_expires_at := now() + interval '14 days';

  INSERT INTO public.organizations (
    name,
    type,
    country,
    city,
    accent_color,
    activity_type,
    business_model,
    size_range,
    trial_expires_at,
    subscription_status,
    plan_fitengine,
    owner_id,
    active,
    billing_currency,
    timezone,
    theme_preset,
    background_type,
    features,
    created_at
  ) VALUES (
    v_name,
    v_org_type,
    nullif(trim(p_country), ''),
    nullif(trim(p_city), ''),
    coalesce(nullif(trim(p_accent_color), ''), '#86C4C7'),
    nullif(trim(p_activity_type), ''),
    v_bm,
    nullif(trim(p_size_range), ''),
    v_trial_expires_at,
    'trial',
    'trial',
    v_uid,
    true,
    upper(coalesce(nullif(trim(p_billing_currency), ''), 'ARS')),
    coalesce(nullif(trim(p_timezone), ''), 'America/Argentina/Buenos_Aires'),
    'dark_vivid',
    'solid',
    jsonb_build_object(
      'reservations', true,
      'onlinePrograms', v_bm = 'coach_online',
      'videoLibrary', true
    ),
    now()
  )
  RETURNING id INTO v_org_id;

  UPDATE public.organization_memberships
  SET is_default = false
  WHERE user_id = v_uid AND active = true;

  INSERT INTO public.organization_memberships (
    user_id,
    organization_id,
    role,
    active,
    is_default,
    created_at
  ) VALUES (
    v_uid,
    v_org_id,
    'owner',
    true,
    true,
    now()
  )
  ON CONFLICT (user_id, organization_id, role) DO UPDATE
  SET active = true, is_default = true;

  UPDATE public.profiles
  SET organization_id = v_org_id,
      role = 'coach'
  WHERE id = v_uid;

  INSERT INTO public.platform_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    organization_id,
    metadata
  ) VALUES (
    v_uid,
    'org_created_with_trial',
    'organization',
    v_org_id::text,
    v_org_id,
    jsonb_build_object(
      'org_name', v_name,
      'business_model', v_bm,
      'org_type', v_org_type,
      'country', nullif(trim(p_country), ''),
      'city', nullif(trim(p_city), ''),
      'size_range', nullif(trim(p_size_range), ''),
      'trial_expires_at', v_trial_expires_at,
      'billing_currency', upper(coalesce(nullif(trim(p_billing_currency), ''), 'ARS')),
      'timezone', coalesce(nullif(trim(p_timezone), ''), 'America/Argentina/Buenos_Aires')
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_org_id,
    'trial_expires_at', v_trial_expires_at,
    'subscription_status', 'trial'
  );
END;
$$;

COMMENT ON FUNCTION public.signup_owner_with_trial IS
  'Alta owner con org nueva y trial SaaS 14 días; membership owner + audit log.';

REVOKE ALL ON FUNCTION public.signup_owner_with_trial FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.signup_owner_with_trial TO authenticated;

CREATE OR REPLACE VIEW public.platform_orgs_overview AS
SELECT
  o.id AS organization_id,
  o.name,
  o.type,
  o.active,
  o.plan_fitengine,
  o.owner_id,
  o.created_at,
  (
    SELECT COUNT(*)::bigint
    FROM public.organization_memberships m
    WHERE m.organization_id = o.id
      AND m.active = true
      AND m.role = 'cliente'
  ) AS client_memberships_count,
  (
    SELECT COUNT(*)::bigint
    FROM public.organization_memberships m
    WHERE m.organization_id = o.id
      AND m.active = true
      AND m.role IN ('coach', 'admin', 'owner', 'superadmin')
  ) AS staff_memberships_count,
  o.subscription_status,
  o.trial_expires_at,
  o.country,
  o.business_model
FROM public.organizations o;

COMMENT ON VIEW public.platform_orgs_overview IS 'Resumen multi-org para panel plataforma; incluye trial SaaS.';
