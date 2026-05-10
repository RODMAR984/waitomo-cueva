const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function assertIncludes(source, token, message) {
  if (!source.includes(token)) throw new Error(message);
}

function run() {
  const appShell = read('navigation/AppShellContent.js');
  const login = read('screens/auth/LoginScreen.js');
  const client = read('screens/client/ClientScreen.js');
  const adminResumen = read('screens/admin/AdminResumenScreen.js');
  const adminObservability = read('screens/admin/AdminObservabilityScreen.js');
  const ingestFn = read('supabase/functions/ingest-observability/index.ts');
  const alertsFn = read('supabase/functions/observability-alerts/index.ts');
  const alertsMigration = read('supabase/migrations/20260424093000_observability_alerts.sql');
  const observability = read('utils/observability.js');

  assertIncludes(observability, 'export function trackEvent', 'Falta trackEvent');
  assertIncludes(observability, 'export function reportError', 'Falta reportError');
  assertIncludes(observability, 'export function setObservabilityContext', 'Falta setObservabilityContext');
  assertIncludes(observability, 'export function getUnsyncedObservabilityEvents', 'Falta getUnsyncedObservabilityEvents');
  assertIncludes(observability, 'export function markObservabilityEventsSynced', 'Falta markObservabilityEventsSynced');

  assertIncludes(appShell, 'setObservabilityContext(', 'AppShellContent no setea contexto de observabilidad');
  assertIncludes(appShell, "trackEvent('navigation_route_change'", 'AppShellContent no trackea cambios de ruta');
  assertIncludes(appShell, "reportError('global_js_error'", 'AppShellContent no reporta errores globales');

  assertIncludes(login, "trackEvent('auth_login_success'", 'Login no trackea login success');
  assertIncludes(login, "reportError('auth_login_failed'", 'Login no reporta login failed');
  assertIncludes(login, "trackEvent('auth_oauth_success'", 'Login no trackea oauth success');

  assertIncludes(client, "trackEvent('client_open_calendario'", 'Client no trackea apertura de calendario');
  assertIncludes(client, "trackEvent('client_open_trabajo_hoy'", 'Client no trackea apertura de trabajo del día');
  assertIncludes(client, "trackEvent('auth_logout_requested'", 'Client no trackea logout');

  assertIncludes(adminResumen, "trackEvent('admin_resumen_staff_move_success'", 'AdminResumen no trackea move success');
  assertIncludes(adminResumen, "reportError('admin_resumen_load_failed'", 'AdminResumen no reporta errores de carga');
  assertIncludes(adminObservability, "invoke('ingest-observability'", 'Panel admin no sincroniza al backend');
  assertIncludes(ingestFn, 'observability_events', 'Edge function no escribe en observability_events');
  assertIncludes(alertsFn, 'obs_error_rate_high', 'Function de alertas no evalua error rate');
  assertIncludes(alertsFn, 'obs_latency_p95_high', 'Function de alertas no evalua latencia p95');
  assertIncludes(alertsFn, 'obs_ingest_silence', 'Function de alertas no evalua silencio de ingest');
  assertIncludes(alertsMigration, 'create table if not exists public.observability_alerts', 'Falta tabla observability_alerts');

  console.log('smoke:observability OK');
}

try {
  run();
} catch (err) {
  console.error('smoke:observability FAIL');
  console.error(err.message || err);
  process.exit(1);
}
