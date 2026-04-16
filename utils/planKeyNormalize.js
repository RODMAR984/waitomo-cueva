/**
 * Clave canónica de plan (misma lógica que ClientScreen / RLS normalize_plan_key_for_chat).
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizePlanKey(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return null;
  if (s.includes('cross')) return 'cross';
  if (s.includes('hyrox')) return 'hyrox';
  if (s.includes('evol')) return 'evolucion';
  if (s.includes('stretch')) return 'stretching';
  if (s.includes('yoga')) return 'yoga';
  if (s.includes('open')) return 'openbox';
  if (s.includes('oly') || s.includes('olímp')) return 'oly';
  if (s.includes('all')) return 'all_access';
  return s.replace(/\s+/g, '_');
}
