-- Corrige INSERT en platform_audit_log dentro de signup_owner_with_trial
-- (columnas reales: entity_type, entity_id, payload — no target_type/metadata).

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
    entity_type,
    entity_id,
    payload
  ) VALUES (
    v_uid,
    'org_created_with_trial',
    'organization',
    v_org_id::text,
    jsonb_build_object(
      'organization_id', v_org_id,
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
