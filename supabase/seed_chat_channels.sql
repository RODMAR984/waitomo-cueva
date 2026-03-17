-- =============================================================================
-- SEED: Canales de chat por plan (para "Ir al chat del plan" en Admin/AdminLite)
-- =============================================================================
-- Ejecutá en Supabase: SQL Editor → New query → Pegar → Run
-- Requiere que ya exista la tabla chat_channels (gym_news_and_chat_schema.sql)
-- =============================================================================

INSERT INTO public.chat_channels (plan_id, name)
VALUES
  ('cross',     'Cross Training'),
  ('yoga',      'Yoga'),
  ('openbox',   'Open Box'),
  ('evolucion', 'Evolución'),
  ('stretching','Stretching'),
  ('oly',       'OLY'),
  ('hyrox',     'Hyrox')
ON CONFLICT (plan_id) DO NOTHING;
