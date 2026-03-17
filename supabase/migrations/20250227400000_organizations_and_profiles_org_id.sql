-- =============================================================================
-- FASE 2 — Data model SaaS: organizations + organization_id en profiles
-- Cada organización (gym/coach) tiene sus datos; RLS aísla por org.
-- Waitomo Training = primera organización (seed).
-- =============================================================================
-- Ejecutar en Supabase SQL Editor o via supabase db push
-- =============================================================================

-- 1) Tabla organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('gym', 'coach')),
  logo_url text,
  accent_color text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  plan_fitengine text DEFAULT 'trial',
  features jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organizations IS 'Una por gym o coach; multi-tenant FitEngine';
COMMENT ON COLUMN public.organizations.accent_color IS 'Hex para botones/highlights';
COMMENT ON COLUMN public.organizations.features IS 'Feature flags: reservations, onlinePrograms, videoLibrary, etc.';

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations (owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON public.organizations (active) WHERE active = true;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2) organization_id en profiles PRIMERO (las políticas RLS de organizations lo referencian)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles (organization_id);

-- Usuarios autenticados ven solo la organización a la que pertenecen (profiles.organization_id)
CREATE POLICY "Users read own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
);

-- Solo owner (superadmin de la org) puede actualizar su organización (Fase 4: GymConfigScreen)
CREATE POLICY "Owner can update organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- 3) Seed: una organización para Waitomo Training (idempotente)
INSERT INTO public.organizations (id, name, type, accent_color, active, plan_fitengine, features)
SELECT gen_random_uuid(), 'Waitomo Training', 'gym', '#00dddd', true, 'gym_basic',
  '{"reservations": true, "onlinePrograms": false, "videoLibrary": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.organizations WHERE name = 'Waitomo Training');

-- Asignar todos los perfiles existentes a la org Waitomo
UPDATE public.profiles p
SET organization_id = (SELECT id FROM public.organizations WHERE name = 'Waitomo Training' LIMIT 1)
WHERE p.organization_id IS NULL;

-- Opcional: asignar owner_id de la org al primer superadmin que exista
UPDATE public.organizations o
SET owner_id = (SELECT id FROM public.profiles WHERE role = 'superadmin' ORDER BY created_at ASC LIMIT 1)
WHERE o.name = 'Waitomo Training' AND o.owner_id IS NULL;

-- 4) Trigger: nuevos usuarios reciben org Waitomo por defecto
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  default_org_id uuid;
BEGIN
  SELECT id INTO default_org_id FROM public.organizations WHERE name = 'Waitomo Training' LIMIT 1;
  INSERT INTO public.profiles (id, role, full_name, organization_id)
  VALUES (
    NEW.id,
    COALESCE(
      CASE WHEN (NEW.raw_user_meta_data->>'role') IN ('coach','admin','superadmin') THEN (NEW.raw_user_meta_data->>'role')::text END,
      'cliente'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'nombre',
      ''
    ),
    default_org_id
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
