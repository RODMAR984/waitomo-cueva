/**
 * Trazado auth / welcome / routing.
 * - Consola: __DEV__, EXPO_PUBLIC_AUTH_TRACE=1, o localStorage `fe_auth_trace` = '1'|'0'
 * - Panel en pantalla (web): SOLO si localStorage `fe_auth_trace_overlay` = '1' (por defecto oculto)
 */
import { Platform } from 'react-native';

const MAX_LINES = 50;
/** @type {string[]} */
let traceLines = [];
/** @type {Set<(lines: string[]) => void>} */
const listeners = new Set();
/** @type {Set<(visible: boolean) => void>} */
const overlayListeners = new Set();

function webLocalTraceOverride() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const v = window.localStorage?.getItem('fe_auth_trace');
    if (v === '1') return true;
    if (v === '0') return false;
  } catch (_) {}
  return null;
}

/** Logs en consola (F12), sin panel en pantalla. */
export function traceEnabled() {
  try {
    const ls = webLocalTraceOverride();
    if (ls === true) return true;
    if (ls === false) return false;
    if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
    return String(process.env.EXPO_PUBLIC_AUTH_TRACE || '').trim() === '1';
  } catch {
    return false;
  }
}

/** Panel flotante AUTH_TRACE en web (desactivado por defecto). */
export function authTraceOverlayEnabled() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem('fe_auth_trace_overlay') === '1';
  } catch (_) {
    return false;
  }
}

/** Oculta el panel y recuerda la preferencia (no afecta consola F12 si fe_auth_trace sigue activo). */
export function hideAuthTraceOverlay() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('fe_auth_trace_overlay', '0');
    } catch (_) {}
  }
  overlayListeners.forEach((fn) => {
    try {
      fn(false);
    } catch (_) {}
  });
}

/** @param {(visible: boolean) => void} fn */
export function subscribeAuthTraceOverlay(fn) {
  overlayListeners.add(fn);
  try {
    fn(authTraceOverlayEnabled());
  } catch (_) {}
  return () => overlayListeners.delete(fn);
}

let bootMs = typeof performance !== 'undefined' ? performance.now() : 0;

function emitLine(line) {
  traceLines = [line, ...traceLines].slice(0, MAX_LINES);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.__FE_AUTH_TRACE__ = traceLines;
    } catch (_) {}
  }
  listeners.forEach((fn) => {
    try {
      fn(traceLines);
    } catch (_) {}
  });
}

/** @param {(lines: string[]) => void} fn */
export function subscribeAuthTrace(fn) {
  listeners.add(fn);
  try {
    fn(traceLines);
  } catch (_) {}
  return () => listeners.delete(fn);
}

export function getAuthTraceLines() {
  return [...traceLines];
}

function bootBanner() {
  if (!traceEnabled()) return;
  const msg = authTraceOverlayEnabled()
    ? '[AUTH_TRACE] consola F12 + panel visible (fe_auth_trace_overlay=1)'
    : '[AUTH_TRACE] solo consola F12 — panel oculto (fe_auth_trace_overlay≠1)';
  // eslint-disable-next-line no-console
  console.error(msg);
  if (authTraceOverlayEnabled()) emitLine(msg);
}

bootBanner();

/**
 * @param {string} phase
 * @param {Record<string, unknown>} [payload]
 */
export function authTrace(phase, payload = {}) {
  if (!traceEnabled()) return;
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  const delta = bootMs ? Math.round(now - bootMs) : 0;
  const row = {
    t: `+${delta}ms`,
    phase,
    platform: Platform.OS,
    ...payload,
  };
  const short = `${row.t} ${phase}`;
  const detail = Object.keys(payload).length ? ` ${JSON.stringify(payload)}` : '';
  const line = `${short}${detail}`;
  if (authTraceOverlayEnabled()) emitLine(line);
  // eslint-disable-next-line no-console
  console.error(`[AUTH_TRACE] ${line}`);
}

/** Estado compacto del AuthContext (sin email ni tokens). */
export function authTraceSnapshot(label, state = {}) {
  if (!traceEnabled()) return;
  const s = state.session?.user;
  authTrace(`snapshot_${label}`, {
    sessionUserId: s?.id ? `${String(s.id).slice(0, 8)}…` : null,
    sessionEmail: s?.email ? `${String(s.email).split('@')[0]}@…` : null,
    profileId: state.profile?.id ? `${String(state.profile.id).slice(0, 8)}…` : null,
    profileRole: state.role ?? null,
    profileOrgId: state.profile?.organization_id
      ? `${String(state.profile.organization_id).slice(0, 8)}…`
      : null,
    orgId: state.organization?.id ? `${String(state.organization.id).slice(0, 8)}…` : null,
    orgName: state.organization?.name ?? null,
    impersonatingOrgId: state.impersonatingOrgId
      ? `${String(state.impersonatingOrgId).slice(0, 8)}…`
      : null,
    activeAppMode: state.activeAppMode ?? null,
    initialProfileSyncDone: state.initialProfileSyncDone ?? null,
    authSessionRestored: state.authSessionRestored ?? null,
    authNavigationReady: state.authNavigationReady ?? null,
    ownedOrgsLoading: state.ownedOrgsLoading ?? null,
    membershipsCount: Array.isArray(state.organizationMemberships)
      ? state.organizationMemberships.length
      : null,
  });
}
