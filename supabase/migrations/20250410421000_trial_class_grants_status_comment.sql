-- Documenta estados de trial_class_grants (incluye completed_attended para uso futuro / reporting).

COMMENT ON COLUMN public.trial_class_grants.status IS
  'scheduled = reserva vigente; cancelled = cancelada a tiempo; completed_no_show = pasó el día sin asistencia ni cancelación a tiempo; completed_attended = asistencia registrada (no reabre acceso a rutinas pasadas).';
