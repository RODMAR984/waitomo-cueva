/**
 * Normaliza texto de bloque de rutina antes de renderizar (cliente / preview).
 */
export function normalizeRoutineBlockText(raw) {
  if (raw == null) return '';
  const s = Array.isArray(raw) ? raw.join('\n') : String(raw);
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
