import { supabase } from '../supabaseClient';
import { normalizePlanKey } from './planKeyNormalize';
import { loadFreeClassGrant, normalizeSlotLabel } from './freeClassGrantStorage';
import { FREE_CLASS_CANCEL_NOTICE_HOURS } from './freeClassPolicy';

async function finalizePastTrialGrantsBestEffort() {
  try {
    await supabase.rpc('finalize_my_past_trial_class_grants');
  } catch {
    // ignore (RPC puede no existir en DB vieja)
  }
}

/**
 * Reserva vigente (scheduled) más próxima del usuario (servidor).
 * @param {string} userId
 * @returns {Promise<import('./freeClassGrantStorage').FreeClassGrant|null>}
 */
export async function fetchLatestTrialClassGrantFromServer(userId) {
  if (!userId) return null;
  await finalizePastTrialGrantsBestEffort();
  const { data, error } = await supabase
    .from('trial_class_grants')
    .select('plan_key, session_date, slot_label, organization_id, created_at, status')
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .order('session_date', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const fk =
    typeof data.session_date === 'string'
      ? data.session_date.slice(0, 10)
      : data.session_date
        ? new Date(data.session_date).toISOString().slice(0, 10)
        : '';
  return {
    planCanonId: normalizePlanKey(data.plan_key) || String(data.plan_key || '').trim(),
    fechaYmd: fk,
    slotLabel: normalizeSlotLabel(data.slot_label),
    organizationId: data.organization_id || null,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
    status: data.status || 'scheduled',
  };
}

/**
 * Servidor primero (fuente para RLS); si no hay fila, AsyncStorage local.
 * @param {string|null|undefined} userId
 */
export async function resolveFreeClassGrant(userId) {
  if (userId) {
    const server = await fetchLatestTrialClassGrantFromServer(userId);
    if (server?.planCanonId && server?.fechaYmd && server?.slotLabel) {
      return server;
    }
  }
  return loadFreeClassGrant();
}

/**
 * @param {object} p
 * @param {string} p.organizationId
 * @param {string} p.planCanonId
 * @param {string} p.fechaYmd
 * @param {string} p.slotLabel
 * @param {number} [p.minNoticeHours]
 */
export async function cancelTrialClassGrantServer({
  organizationId,
  planCanonId,
  fechaYmd,
  slotLabel,
  minNoticeHours = FREE_CLASS_CANCEL_NOTICE_HOURS,
}) {
  const org = String(organizationId || '').trim();
  const pk = normalizePlanKey(planCanonId);
  const fk = String(fechaYmd || '').slice(0, 10);
  const slot = normalizeSlotLabel(slotLabel);
  if (!org || !pk || !fk || !slot) return { ok: false, reason: 'invalid_payload' };

  await finalizePastTrialGrantsBestEffort();

  const { data, error } = await supabase.rpc('cancel_my_trial_class_grant', {
    p_organization_id: org,
    p_plan_key: pk,
    p_session_date: fk,
    p_slot_label: slot,
    p_min_notice_hours: minNoticeHours,
  });
  if (error) return { ok: false, error };
  if (!data || data.ok !== true) {
    return { ok: false, reason: data?.reason || 'rpc_failed', payload: data };
  }
  return { ok: true, data };
}

/**
 * @param {object} p
 * @param {string} p.userId
 * @param {string} p.organizationId
 * @param {string} p.planCanonId
 * @param {string} p.fechaYmd
 * @param {string} p.slotLabel
 * @param {string} [p.contactNote]
 */
export async function insertTrialClassGrantServer({
  userId,
  organizationId,
  planCanonId,
  fechaYmd,
  slotLabel,
  contactNote,
}) {
  if (!userId || !organizationId) return { ok: false, reason: 'missing_user_or_org' };
  const pk = normalizePlanKey(planCanonId);
  const fk = String(fechaYmd || '').slice(0, 10);
  const slot = normalizeSlotLabel(slotLabel);
  if (!pk || !fk || !slot) return { ok: false, reason: 'invalid_payload' };

  await finalizePastTrialGrantsBestEffort();

  const { data, error } = await supabase.rpc('book_my_trial_class_grant', {
    p_organization_id: organizationId,
    p_plan_key: pk,
    p_session_date: fk,
    p_slot_label: slot,
    p_contact_note: contactNote || null,
  });
  if (error) return { ok: false, error };
  if (!data || data.ok !== true) {
    return { ok: false, reason: data?.reason || 'rpc_failed', payload: data };
  }

  return { ok: true, data };
}
