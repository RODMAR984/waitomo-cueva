import { Platform } from 'react-native';

const OWNER_KEY = 'waitomo_web_session_owner_v1';

function storage() {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return null;
  return sessionStorage;
}

/** Ancla la sesión web al usuario que entró bien (evita token viejo de otro mail en el mismo origen). */
export function persistWebSessionOwner(userId, email) {
  const ss = storage();
  const uid = userId && String(userId).trim();
  if (!ss || !uid) return;
  try {
    ss.setItem(
      OWNER_KEY,
      JSON.stringify({
        userId: uid,
        email: email ? String(email).trim().toLowerCase() : '',
        ts: Date.now(),
      }),
    );
  } catch (_) {
    /* ignore */
  }
}

export function clearWebSessionOwner() {
  const ss = storage();
  if (!ss) return;
  try {
    ss.removeItem(OWNER_KEY);
  } catch (_) {
    /* ignore */
  }
}

/**
 * @returns {boolean} false si el token local no coincide con el último login confirmado en este origen.
 */
export function isWebSessionOwnerConsistent(user) {
  const ss = storage();
  const uid = user?.id && String(user.id).trim();
  if (!ss || !uid) return true;
  try {
    const raw = ss.getItem(OWNER_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    if (parsed?.userId && String(parsed.userId) !== uid) return false;
    const pinned = parsed?.email ? String(parsed.email).trim().toLowerCase() : '';
    const live = user?.email ? String(user.email).trim().toLowerCase() : '';
    if (pinned && live && pinned !== live) return false;
    return true;
  } catch (_) {
    return true;
  }
}
