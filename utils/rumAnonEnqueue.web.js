/**
 * Cola RUM anónima → Edge `ingest-rum-anon` (sin sesión Supabase).
 * Requiere en build: EXPO_PUBLIC_RUM_ANON_KEY (igual a secret RUM_ANON_INGEST_KEY en la función).
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabaseClient';

const queue = [];
let timer = null;
const MAX_QUEUED = 35;
const FLUSH_MS = 7000;

function getKey() {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_RUM_ANON_KEY) {
      return String(process.env.EXPO_PUBLIC_RUM_ANON_KEY).trim();
    }
  } catch (_) {
    /* ignore */
  }
  return '';
}

export function enqueueWebRumAnonEvent(event) {
  const key = getKey();
  if (!key || typeof window === 'undefined') return;
  if (!event || typeof event.name !== 'string') return;
  queue.push({
    name: event.name,
    ts: event.ts || new Date().toISOString(),
    payload: event.payload && typeof event.payload === 'object' ? event.payload : {},
  });
  if (queue.length > MAX_QUEUED) queue.splice(0, queue.length - MAX_QUEUED);
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushWebRumAnonNow();
  }, FLUSH_MS);
}

export async function flushWebRumAnonNow() {
  const key = getKey();
  if (!key || queue.length === 0) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const batch = queue.splice(0, 40);
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/ingest-rum-anon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        'x-rum-anon-key': key,
      },
      body: JSON.stringify({ events: batch }),
    });
  } catch (_) {
    queue.unshift(...batch);
  }
}
