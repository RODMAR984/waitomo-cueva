// utils/planPolicy.js — Refactor Waitomo
// -------------------------------------------------------
// Política de visibilidad/propiedad de BLOQUES diarios
// entre coaches dentro de cada plan.
//
// Cumple normas Waitomo:
// - Sin colores ni estilos (dark-only global)
// - Funcionalidad 100 % preservada
// - API idéntica: PLAN_POLICY + getPlanPolicy()
// - Extendible sin romper compatibilidad
// -------------------------------------------------------

/**
 * Política por plan:
 * - "SHARED": los coaches comparten bloques (todos ven/pueden editar todo).
 * - "PARTITIONED": cada coach ve/edita solo sus bloques (por coachId).
 */
export const PLAN_POLICY = {
  cross_training: 'SHARED',      // generales del box
  cross: 'SHARED',
  pase_total: 'SHARED',         // socio del club — todas las actividades
  all_access: 'SHARED',
  hyrox: 'SHARED',               // competencias compartidas
  ciclo_evolucion: 'PARTITIONED',// personalizados / grupos chicos
  stretching: 'PARTITIONED',
  yoga: 'PARTITIONED',
  open_box: 'PARTITIONED',
};

/**
 * Devuelve la política de un plan según su clave.
 * Si el plan no está definido, retorna 'SHARED' (por defecto).
 *
 * @param {string} planValue - Nombre o valor del plan (case-insensitive)
 * @returns {'SHARED' | 'PARTITIONED'}
 */
export function getPlanPolicy(planValue) {
  const key = String(planValue || '').toLowerCase().trim();
  return PLAN_POLICY[key] || 'SHARED';
}

/**
 * Permite registrar nuevas políticas dinámicamente sin alterar la constante base.
 * Útil si se crean planes nuevos en tiempo de ejecución.
 *
 * @param {string} planKey - Clave del plan
 * @param {'SHARED' | 'PARTITIONED'} policy - Política a asignar
 */
export function registerPlanPolicy(planKey, policy = 'SHARED') {
  const k = String(planKey || '').toLowerCase().trim();
  if (!k) return;
  if (!['SHARED', 'PARTITIONED'].includes(policy)) return;
  PLAN_POLICY[k] = policy;
}
