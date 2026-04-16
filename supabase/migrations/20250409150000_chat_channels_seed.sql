-- Canales por plan (si la tabla está vacía o faltan filas, el cliente ve 0 resultados sin error).
INSERT INTO public.chat_channels (plan_id, name) VALUES
  ('cross', 'Cross Training'),
  ('yoga', 'Yoga'),
  ('openbox', 'Open Box'),
  ('evolucion', 'Ciclo Evolución'),
  ('stretching', 'Stretching'),
  ('oly', 'OLY'),
  ('hyrox', 'Hyrox'),
  ('all_access', 'Pase libre / todos los planes')
ON CONFLICT (plan_id) DO NOTHING;
