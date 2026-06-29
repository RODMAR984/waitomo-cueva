/**
 * Variantes de plan_key al consultar bloques (legacy value vs code corto).
 * Alineado con supabase/functions/generate-routine — válido para cualquier org.
 */

const LEGACY_TO_SHORT = {
  cross_training: 'cross',
  hyrox: 'hyrox',
  ciclo_evolucion: 'evolucion',
  stretching: 'stretching',
  yoga: 'yoga',
  open_box: 'openbox',
};

export function planKeysForQuery(planKey) {
  const s = String(planKey || '').trim();
  if (!s) return null;
  const short = LEGACY_TO_SHORT[s] || s;
  return short === s ? [s] : [s, short];
}

export function expandPlanKeysList(keys) {
  const out = new Set();
  for (const k of keys || []) {
    const variants = planKeysForQuery(k);
    if (variants) variants.forEach((v) => out.add(v));
    else if (k) out.add(String(k).trim());
  }
  return [...out];
}
