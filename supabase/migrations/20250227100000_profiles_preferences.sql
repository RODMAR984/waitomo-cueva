-- Preferencias de usuario: tema y notificaciones (Config desde Perfil)
-- Ejecutar en Supabase SQL Editor si no usás migraciones automáticas.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_mode text DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS notif_messages boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_trabajo_dia boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_novedades boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_plan_pago boolean DEFAULT true;

COMMENT ON COLUMN public.profiles.theme_mode IS 'light | dark | auto';
COMMENT ON COLUMN public.profiles.notif_messages IS 'Notificaciones de mensajes/chat';
COMMENT ON COLUMN public.profiles.notif_trabajo_dia IS 'Aviso cuando suben trabajo del día de tu plan';
COMMENT ON COLUMN public.profiles.notif_novedades IS 'Novedades del gym';
COMMENT ON COLUMN public.profiles.notif_plan_pago IS 'Preaviso fin de plan o pago';
