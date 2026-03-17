-- =============================================================================
-- FIX: permitir role 'superadmin' en profiles
-- =============================================================================
-- Error: profiles_role_check no permite 'superadmin'.
-- Ejecutá en Supabase: SQL Editor → New query → Pegar → Run
-- =============================================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check,
  ADD CONSTRAINT profiles_role_check CHECK (
    role IN ('cliente', 'coach', 'admin', 'superadmin')
  );
