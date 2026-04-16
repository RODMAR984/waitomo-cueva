// Normaliza claves de plan entre Admin (cross_training), tabla plans (cross) y rutas (TrabajoDelDia).

const LEGACY_TO_CODE = {
  cross_training: 'cross',
  ciclo_evolucion: 'evolucion',
  open_box: 'openbox',
  pase_total: 'all_access',
};

/**
 * Clave canónica tipo chat/plans (cross, hyrox, …).
 * Acepta variantes extendidas por org (ej: cross_pase_full -> cross).
 */
export function normalizeBlockPlanKey(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim().toLowerCase();
  if (!s) return '';

  const mapped = LEGACY_TO_CODE[s];
  if (mapped) return mapped;

  if (s.includes('cross')) return 'cross';
  if (s.includes('hyrox')) return 'hyrox';
  if (s.includes('evol')) return 'evolucion';
  if (s.includes('stretch')) return 'stretching';
  if (s.includes('yoga')) return 'yoga';
  if (s.includes('open')) return 'openbox';
  if (s.includes('oly') || s.includes('olimp')) return 'oly';
  if (s.includes('all') || s.includes('pase_total') || s.includes('pase libre')) return 'all_access';

  return s.replace(/\s+/g, '_');
}

/**
 * Comparación suelta para filtrar bloques del día vs plan de la ruta.
 */
export function plansMatchForBlocks(bloquePlan, routePlanValue) {
  const a = normalizeBlockPlanKey(bloquePlan);
  const b = normalizeBlockPlanKey(routePlanValue);
  if (!a || !b) return false;
  return a === b;
}
