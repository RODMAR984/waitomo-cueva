-- =============================================================================
-- #20b SISTEMA DE TEMAS — branding multi-org: theme_preset, background_type, background_url
-- =============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS theme_preset text DEFAULT 'dark_vivid'
    CHECK (theme_preset IS NULL OR theme_preset IN ('dark_vivid', 'dark_minimal', 'light_clean', 'light_warm')),
  ADD COLUMN IF NOT EXISTS background_type text DEFAULT 'solid'
    CHECK (background_type IS NULL OR background_type IN ('solid', 'gradient', 'image')),
  ADD COLUMN IF NOT EXISTS background_url text;

COMMENT ON COLUMN public.organizations.theme_preset IS 'Preset de tema: dark_vivid | dark_minimal | light_clean | light_warm';
COMMENT ON COLUMN public.organizations.background_type IS 'Tipo de fondo: solid | gradient | image';
COMMENT ON COLUMN public.organizations.background_url IS 'URL de imagen de fondo (Supabase Storage) si background_type = image';
