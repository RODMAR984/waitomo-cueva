/**
 * Trazado quirúrgico de auth / welcome / post-login.
 *
 * Activación explícita solamente: `EXPO_PUBLIC_AUTH_TRACE=1` en `.env` (Expo inyecta `process.env`).
 * Sin flag: cero logs (no ensuciar consola en prod ni en dev por defecto).
 *
 * Uso: `import { authTrace } from '../utils/authTrace';`
 *       `authTrace('navigateToDestination', { profileId: profile?.id ?? null, ... });`
 */

function traceEnabled() {
  try {
    return String(process.env.EXPO_PUBLIC_AUTH_TRACE || '').trim() === '1';
  } catch {
    return false;
  }
}

/**
 * @param {string} phase  Etiqueta corta (snake_case o PascalCase), estable para grepear.
 * @param {Record<string, unknown>} [payload]  Solo datos serializables; evitar PII (emails completos, tokens).
 */
export function authTrace(phase, payload = {}) {
  if (!traceEnabled()) return;
  const ts = typeof performance !== 'undefined' && performance.now ? performance.now().toFixed(0) : '';
  const prefix = ts ? `[AUTH_TRACE +${ts}ms]` : '[AUTH_TRACE]';
  // eslint-disable-next-line no-console
  console.log(prefix, phase, payload);
}
