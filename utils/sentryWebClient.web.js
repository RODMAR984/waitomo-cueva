/**
 * Sentry en web. Activación: EXPO_PUBLIC_SENTRY_DSN en el entorno de build.
 * Opcional: EXPO_PUBLIC_SENTRY_ENVIRONMENT, EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE (0–1).
 */
import * as Sentry from '@sentry/react';

let initialized = false;

function readEnv(name) {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return String(process.env[name]).trim();
    }
  } catch (_) {
    /* ignore */
  }
  return '';
}

export function initSentryWebFromEnv() {
  if (initialized) return;
  const dsn = readEnv('EXPO_PUBLIC_SENTRY_DSN');
  if (!dsn) return;

  const tracesRaw = readEnv('EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE');
  const tracesSampleRate = tracesRaw === '' ? 0.06 : Number(tracesRaw);
  const safeTraceRate = Number.isFinite(tracesSampleRate)
    ? Math.min(1, Math.max(0, tracesSampleRate))
    : 0.06;

  const environment =
    readEnv('EXPO_PUBLIC_SENTRY_ENVIRONMENT') ||
    (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'
      ? 'development'
      : 'production');

  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    tracesSampleRate: safeTraceRate,
    integrations: [Sentry.browserTracingIntegration()],
  });
  initialized = true;
}

export function syncSentryUserContext({ userId, role, organizationId } = {}) {
  if (!initialized) return;
  if (userId) {
    Sentry.setUser({ id: String(userId) });
  } else {
    Sentry.setUser(null);
  }
  Sentry.setTag('role', role ? String(role) : '');
  Sentry.setTag('organization_id', organizationId ? String(organizationId) : '');
}

export function captureClientError(name, error, payload = {}) {
  if (!initialized) return;
  const msg = error?.message != null ? String(error.message) : String(error || 'error');
  const err = error instanceof Error ? error : new Error(msg);
  if (!(error instanceof Error) && error?.stack) {
    err.stack = String(error.stack);
  }
  Sentry.captureException(err, {
    tags: { observability_name: String(name || 'error') },
    extra: typeof payload === 'object' && payload && !Array.isArray(payload) ? payload : { value: payload },
  });
}
