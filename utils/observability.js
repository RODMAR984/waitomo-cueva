import { captureClientError as sentryCaptureClientError } from './sentryWebClient';

const MAX_EVENTS = 200;

const state = {
  userId: null,
  role: null,
  organizationId: null,
  events: [],
  seq: 0,
};

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const out = {};
  Object.keys(payload).forEach((k) => {
    const v = payload[k];
    if (v == null) return;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
      return;
    }
    if (Array.isArray(v)) {
      out[k] = v.slice(0, 10).map((x) => (typeof x === 'string' ? x : String(x)));
      return;
    }
    out[k] = String(v);
  });
  return out;
}

function pushEvent(event) {
  state.seq += 1;
  state.events.push({
    ...event,
    id: `${Date.now()}_${state.seq}`,
    synced: false,
  });
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
}

export function setObservabilityContext({ userId, role, organizationId } = {}) {
  state.userId = userId || null;
  state.role = role || null;
  state.organizationId = organizationId || null;
}

export function trackEvent(name, payload = {}) {
  const evt = {
    type: 'event',
    name: String(name || 'unknown'),
    ts: new Date().toISOString(),
    userId: state.userId,
    role: state.role,
    organizationId: state.organizationId,
    payload: sanitizePayload(payload),
  };
  pushEvent(evt);
  // eslint-disable-next-line no-console
  console.log('OBS_EVENT', evt);
}

export function reportError(name, error, payload = {}) {
  const evt = {
    type: 'error',
    name: String(name || 'error'),
    ts: new Date().toISOString(),
    userId: state.userId,
    role: state.role,
    organizationId: state.organizationId,
    payload: sanitizePayload(payload),
    errorMessage: String(error?.message || error || ''),
    stack: String(error?.stack || '').slice(0, 2000),
  };
  pushEvent(evt);
  // eslint-disable-next-line no-console
  console.error('OBS_ERROR', evt);

  try {
    sentryCaptureClientError(name, error, payload);
  } catch (_) {
    /* Sentry no disponible */
  }
}

export function getObservabilitySnapshot() {
  return {
    userId: state.userId,
    role: state.role,
    organizationId: state.organizationId,
    events: [...state.events],
  };
}

export function getUnsyncedObservabilityEvents(limit = 50) {
  const max = Math.max(1, Math.min(Number(limit) || 50, 200));
  return state.events.filter((e) => !e.synced).slice(-max);
}

export function markObservabilityEventsSynced(eventIds = []) {
  if (!Array.isArray(eventIds) || eventIds.length === 0) return 0;
  const idSet = new Set(eventIds.map((x) => String(x)));
  let updated = 0;
  state.events = state.events.map((e) => {
    if (!idSet.has(String(e.id))) return e;
    if (e.synced) return e;
    updated += 1;
    return { ...e, synced: true };
  });
  return updated;
}

export function clearObservabilityEvents({ onlySynced = false } = {}) {
  if (onlySynced) {
    state.events = state.events.filter((e) => !e.synced);
    return;
  }
  state.events = [];
}
