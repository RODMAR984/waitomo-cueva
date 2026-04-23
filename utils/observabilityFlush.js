/**
 * Envía eventos locales de observabilidad a `ingest-observability` (sesión requerida).
 * Throttle para no spamear la edge; los errores no vacían la cola (se reintenta).
 */
import { supabase } from '../supabaseClient';
import { getUnsyncedObservabilityEvents, markObservabilityEventsSynced } from './observability';

const MIN_INTERVAL_MS = 45000;
let lastAttemptAt = 0;
let inFlight = false;

function mapEventsForIngest(unsynced) {
  return unsynced.map((e) => ({
    id: e.id,
    type: e.type,
    name: e.name,
    ts: e.ts,
    role: e.role || null,
    organization_id: e.organizationId || null,
    payload: e.payload || {},
    error_message: e.errorMessage || null,
    stack: e.stack || null,
  }));
}

/**
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<{ ok: boolean, synced?: number, skipped?: boolean, reason?: string }>}
 */
export async function flushObservabilityEventsIfNeeded(opts = {}) {
  const force = !!opts.force;
  const unsynced = getUnsyncedObservabilityEvents(100);
  if (unsynced.length === 0) {
    return { ok: true, synced: 0 };
  }

  const now = Date.now();
  if (!force && now - lastAttemptAt < MIN_INTERVAL_MS) {
    return { ok: true, skipped: true };
  }
  if (inFlight) {
    return { ok: true, skipped: true };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    return { ok: false, reason: 'no_session' };
  }

  inFlight = true;
  lastAttemptAt = now;
  try {
    const payload = { events: mapEventsForIngest(unsynced) };
    const { data, error } = await supabase.functions.invoke('ingest-observability', {
      body: payload,
    });
    if (error) throw error;
    const syncedIds = Array.isArray(data?.synced_ids) ? data.synced_ids : unsynced.map((e) => e.id);
    markObservabilityEventsSynced(syncedIds);
    return { ok: true, synced: syncedIds.length };
  } catch (e) {
    lastAttemptAt = 0;
    return { ok: false, reason: String(e?.message || e || 'invoke_failed') };
  } finally {
    inFlight = false;
  }
}
