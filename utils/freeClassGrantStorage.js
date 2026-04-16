import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizePlanKey } from './planKeyNormalize';

const STORAGE_KEY = 'waitomo_free_class_grant_v1';

/**
 * @typedef {{ planCanonId: string, fechaYmd: string, slotLabel: string, organizationId: string|null, createdAt: number }} FreeClassGrant
 */

/**
 * @param {object} p
 * @param {string} p.planCanonId
 * @param {string} p.fechaYmd
 * @param {string} p.slotLabel
 * @param {string|null} [p.organizationId]
 */
export async function saveFreeClassGrant({ planCanonId, fechaYmd, slotLabel, organizationId }) {
  const plan = normalizePlanKey(planCanonId);
  const fk = String(fechaYmd || '').slice(0, 10);
  const slot = normalizeSlotLabel(slotLabel);
  if (!plan || !fk || !slot) return;
  const payload = {
    planCanonId: plan,
    fechaYmd: fk,
    slotLabel: slot,
    organizationId: organizationId || null,
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function loadFreeClassGrant() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return null;
    return {
      planCanonId: normalizePlanKey(o.planCanonId),
      fechaYmd: String(o.fechaYmd || '').slice(0, 10),
      slotLabel: normalizeSlotLabel(o.slotLabel),
      organizationId: o.organizationId || null,
      createdAt: Number(o.createdAt) || 0,
    };
  } catch {
    return null;
  }
}

export async function clearFreeClassGrant() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function normalizeSlotLabel(h) {
  const s = String(h || '').trim();
  if (!s) return '';
  if (s.length >= 5) return s.slice(0, 5);
  if (/^\d{1,2}$/.test(s)) return `${s.padStart(2, '0')}:00`;
  if (/^\d{1,2}:\d{1,2}$/.test(s)) {
    const [hh, mm] = s.split(':');
    return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
  }
  return s;
}
