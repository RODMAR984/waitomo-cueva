import { normalizePlanKey } from './planKeyNormalize';
import { formatYmdLocal } from './formatYmdLocal';
import { normalizeSlotLabel } from './freeClassGrantStorage';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Abono con status activo y vigencia / cupo de sesiones coherente (fecha local).
 * @param {object|null|undefined} row
 * @returns {boolean}
 */
export function isUserAbonoActive(row) {
  if (!row) return false;
  if (String(row.status || '').toLowerCase() !== 'active') return false;

  const today = formatYmdLocal(new Date());
  if (row.end_date) {
    const end = String(row.end_date).slice(0, 10);
    if (end && end < today) return false;
  }
  if (row.start_date) {
    const start = String(row.start_date).slice(0, 10);
    if (start && start > today) return false;
  }

  const total = row.sessions_total;
  if (total != null && Number(total) > 0) {
    const used = Number(row.sessions_used) || 0;
    if (used >= Number(total)) return false;
  }
  return true;
}

/**
 * El abono aplica al plan que el usuario eligió (canon: cross, openbox, …).
 * @param {object} abonoRow
 * @param {string|null|undefined} userPlanCanon
 */
export function abonoCoversUserPlan(abonoRow, userPlanCanon) {
  const u = normalizePlanKey(userPlanCanon);
  if (!u) return false;
  const raw = String(abonoRow?.plan_id || '').trim();
  if (!raw) return false;

  if (UUID_RE.test(raw)) {
    return true;
  }

  const p = normalizePlanKey(raw);
  if (!p) return false;
  if (u === 'all_access' || p === 'all_access') return true;
  return p === u;
}

/**
 * @param {import('./freeClassGrantStorage').FreeClassGrant|null} grant
 * @param {{ planCanonKey: string, organizationId: string|null, fechaYmd: string, horarioNormalized: string }} ctx
 */
export function freeClassGrantCoversSession(grant, ctx) {
  if (!grant || !grant.planCanonId || !grant.fechaYmd || !grant.slotLabel) return false;
  const { planCanonKey, organizationId, fechaYmd, horarioNormalized } = ctx;
  const gPlan = normalizePlanKey(grant.planCanonId);
  const uPlan = normalizePlanKey(planCanonKey);
  if (!gPlan || !uPlan || gPlan !== uPlan) return false;

  if (grant.organizationId && organizationId && String(grant.organizationId) !== String(organizationId)) {
    return false;
  }

  if (String(grant.fechaYmd).slice(0, 10) !== String(fechaYmd).slice(0, 10)) return false;

  const gSlot = normalizeSlotLabel(grant.slotLabel);
  const h = normalizeSlotLabel(horarioNormalized);
  if (!h) return false;
  return gSlot === h;
}

/**
 * @param {import('./freeClassGrantStorage').FreeClassGrant|null} grant
 */
export function freeClassGrantIsForToday(grant) {
  if (!grant?.fechaYmd) return false;
  return String(grant.fechaYmd).slice(0, 10) === formatYmdLocal(new Date());
}

/**
 * Clase de prueba agendada (misma sede y plan) — no exige que sea hoy.
 * @param {import('./freeClassGrantStorage').FreeClassGrant|null} grant
 * @param {{ planCanonKey: string, organizationId: string|null }} ctx
 */
export function freeClassGrantMatchesPlanAndOrg(grant, ctx) {
  if (!grant || !grant.planCanonId || !grant.fechaYmd || !grant.slotLabel) return false;
  const { planCanonKey, organizationId } = ctx;
  const gPlan = normalizePlanKey(grant.planCanonId);
  const uPlan = normalizePlanKey(planCanonKey);
  if (!gPlan || !uPlan || gPlan !== uPlan) return false;
  if (grant.organizationId && organizationId && String(grant.organizationId) !== String(organizationId)) {
    return false;
  }
  return true;
}

/**
 * Evalúa acceso a pantallas de rutina (cliente).
 * @param {{
 *   planCanonKey: string|null,
 *   organizationId: string|null,
 *   abonoRow: object|null,
 *   abonoLoading: boolean,
 *   freeClassGrant: import('./freeClassGrantStorage').FreeClassGrant|null,
 *   fechaYmd: string,
 *   horarioNormalized: string,
 * }} p
 * @returns {{ ok: boolean, reason?: 'loading'|'no_plan'|'no_entitlement', via?: 'abono'|'free_class' }}
 */
export function evaluateWorkoutEntitlement(p) {
  const {
    planCanonKey,
    organizationId,
    abonoRow,
    abonoLoading,
    freeClassGrant,
    fechaYmd,
    horarioNormalized,
  } = p;

  if (abonoLoading) return { ok: false, reason: 'loading' };

  const canon = normalizePlanKey(planCanonKey);
  if (!canon) return { ok: false, reason: 'no_plan' };

  if (isUserAbonoActive(abonoRow) && abonoCoversUserPlan(abonoRow, canon)) {
    return { ok: true, via: 'abono' };
  }

  const fk = String(fechaYmd || '').slice(0, 10);
  const h = normalizeSlotLabel(horarioNormalized);
  if (
    freeClassGrant &&
    fk &&
    h &&
    freeClassGrantCoversSession(freeClassGrant, {
      planCanonKey: canon,
      organizationId,
      fechaYmd: fk,
      horarioNormalized: h,
    })
  ) {
    return { ok: true, via: 'free_class' };
  }

  return { ok: false, reason: 'no_entitlement' };
}

/**
 * Puede abrir "Trabajo hoy" (fecha = hoy): abono activo o clase gratis justo para hoy con horario conocido.
 */
export function evaluateTrabajoHoyButton(p) {
  const {
    planCanonKey,
    organizationId,
    abonoRow,
    abonoLoading,
    freeClassGrant,
  } = p;

  if (abonoLoading) return { ok: false, reason: 'loading' };
  const canon = normalizePlanKey(planCanonKey);
  if (!canon) return { ok: false, reason: 'no_plan' };

  if (isUserAbonoActive(abonoRow) && abonoCoversUserPlan(abonoRow, canon)) {
    return { ok: true, via: 'abono', horario: '', fechaYmd: formatYmdLocal(new Date()) };
  }

  const today = formatYmdLocal(new Date());
  const g = freeClassGrant;
  if (
    g &&
    normalizePlanKey(g.planCanonId) === canon &&
    String(g.fechaYmd).slice(0, 10) === today &&
    (!g.organizationId || !organizationId || String(g.organizationId) === String(organizationId))
  ) {
    return {
      ok: true,
      via: 'free_class',
      horario: normalizeSlotLabel(g.slotLabel),
      fechaYmd: today,
    };
  }

  return { ok: false, reason: 'no_entitlement' };
}

/**
 * Acceso al calendario de rutina: solo con abono activo (no alcanza clase gratis suelta).
 */
export function evaluateCalendarioAccess(p) {
  const { planCanonKey, abonoRow, abonoLoading, organizationId, freeClassGrant } = p;
  if (abonoLoading) return { ok: false, reason: 'loading' };
  const canon = normalizePlanKey(planCanonKey);
  if (!canon) return { ok: false, reason: 'no_plan' };
  if (isUserAbonoActive(abonoRow) && abonoCoversUserPlan(abonoRow, canon)) {
    return { ok: true, via: 'abono' };
  }
  if (
    freeClassGrant &&
    freeClassGrantMatchesPlanAndOrg(freeClassGrant, { planCanonKey: canon, organizationId })
  ) {
    return { ok: true, via: 'free_class' };
  }
  return { ok: false, reason: 'no_entitlement' };
}

/**
 * Chat (lista general) / novedades / accesos desde Home: usa el plan canónico del perfil.
 * Para un canal concreto, usar `evaluateCalendarioAccess` con `planCanonKey = plan_id` del canal.
 * @param {{
 *   planCanonKey: string|null,
 *   organizationId: string|null,
 *   abonoRow: object|null,
 *   abonoLoading: boolean,
 *   freeClassGrant: import('./freeClassGrantStorage').FreeClassGrant|null,
 * }} p
 */
export function evaluateClientCommunityAccess(p) {
  return evaluateCalendarioAccess(p);
}
