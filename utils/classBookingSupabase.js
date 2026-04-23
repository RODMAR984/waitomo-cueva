import { supabase } from '../supabaseClient';
import { normalizePlanKey } from './planKeyNormalize';
import { normalizeSlotLabel } from './freeClassGrantStorage';

/**
 * @param {object} p
 * @param {string} p.organizationId
 * @param {string} p.planCanonId
 * @param {string} p.fechaYmd
 * @param {string} p.slotLabel
 */
export async function bookClassSlotServer({
  organizationId,
  planCanonId,
  fechaYmd,
  slotLabel,
  acceptMedicalResponsibility = false,
}) {
  const org = String(organizationId || '').trim();
  const pk = normalizePlanKey(planCanonId);
  const fk = String(fechaYmd || '').slice(0, 10);
  const slot = normalizeSlotLabel(slotLabel);
  if (!org || !pk || !fk || !slot) return { ok: false, reason: 'invalid_payload' };

  const { data, error } = await supabase.rpc('book_class_slot', {
    p_organization_id: org,
    p_plan_key: pk,
    p_session_date: fk,
    p_slot_label: slot,
    p_accept_medical_responsibility: !!acceptMedicalResponsibility,
  });

  if (error) return { ok: false, reason: 'rpc_error', error };
  if (!data || data.ok !== true) return { ok: false, reason: data?.reason || 'rpc_failed', payload: data };
  return { ok: true, data };
}

/**
 * @param {object} p
 * @param {string} p.organizationId
 * @param {string} p.planCanonId
 * @param {string} p.fechaYmd
 * @param {string} p.slotLabel
 * @param {number} [p.minNoticeHours]
 */
export async function cancelClassSlotServer({
  organizationId,
  planCanonId,
  fechaYmd,
  slotLabel,
  minNoticeHours = null,
}) {
  const org = String(organizationId || '').trim();
  const pk = normalizePlanKey(planCanonId);
  const fk = String(fechaYmd || '').slice(0, 10);
  const slot = normalizeSlotLabel(slotLabel);
  if (!org || !pk || !fk || !slot) return { ok: false, reason: 'invalid_payload' };

  const { data, error } = await supabase.rpc('cancel_class_slot', {
    p_organization_id: org,
    p_plan_key: pk,
    p_session_date: fk,
    p_slot_label: slot,
    p_min_notice_hours: minNoticeHours == null ? null : Number(minNoticeHours),
  });

  if (error) return { ok: false, reason: 'rpc_error', error };
  if (!data || data.ok !== true) return { ok: false, reason: data?.reason || 'rpc_failed', payload: data };
  return { ok: true, data };
}

export async function joinClassWaitlistServer({
  organizationId,
  planCanonId,
  fechaYmd,
  slotLabel,
  acceptMedicalResponsibility = false,
}) {
  const org = String(organizationId || '').trim();
  const pk = normalizePlanKey(planCanonId);
  const fk = String(fechaYmd || '').slice(0, 10);
  const slot = normalizeSlotLabel(slotLabel);
  if (!org || !pk || !fk || !slot) return { ok: false, reason: 'invalid_payload' };
  const { data, error } = await supabase.rpc('join_class_waitlist', {
    p_organization_id: org,
    p_plan_key: pk,
    p_session_date: fk,
    p_slot_label: slot,
    p_accept_medical_responsibility: !!acceptMedicalResponsibility,
  });
  if (error) return { ok: false, reason: 'rpc_error', error };
  if (!data || data.ok !== true) return { ok: false, reason: data?.reason || 'rpc_failed', payload: data };
  return { ok: true, data };
}

export async function leaveClassWaitlistServer({ organizationId, planCanonId, fechaYmd, slotLabel }) {
  const org = String(organizationId || '').trim();
  const pk = normalizePlanKey(planCanonId);
  const fk = String(fechaYmd || '').slice(0, 10);
  const slot = normalizeSlotLabel(slotLabel);
  if (!org || !pk || !fk || !slot) return { ok: false, reason: 'invalid_payload' };
  const { data, error } = await supabase.rpc('leave_class_waitlist', {
    p_organization_id: org,
    p_plan_key: pk,
    p_session_date: fk,
    p_slot_label: slot,
  });
  if (error) return { ok: false, reason: 'rpc_error', error };
  if (!data || data.ok !== true) return { ok: false, reason: data?.reason || 'rpc_failed', payload: data };
  return { ok: true, data };
}

export async function staffCancelClassBookingServer({ bookingId, reason }) {
  if (!bookingId) return { ok: false, reason: 'invalid_payload' };
  const { data, error } = await supabase.rpc('staff_cancel_class_booking', {
    p_booking_id: bookingId,
    p_reason: reason || null,
  });
  if (error) return { ok: false, reason: 'rpc_error', error };
  if (!data || data.ok !== true) return { ok: false, reason: data?.reason || 'rpc_failed', payload: data };
  return { ok: true, data };
}

export async function staffMoveClassBookingServer({ bookingId, newSlotLabel }) {
  if (!bookingId || !newSlotLabel) return { ok: false, reason: 'invalid_payload' };
  const slot = normalizeSlotLabel(newSlotLabel);
  const { data, error } = await supabase.rpc('staff_move_class_booking', {
    p_booking_id: bookingId,
    p_new_slot_label: slot,
  });
  if (error) return { ok: false, reason: 'rpc_error', error };
  if (!data || data.ok !== true) return { ok: false, reason: data?.reason || 'rpc_failed', payload: data };
  return { ok: true, data };
}

