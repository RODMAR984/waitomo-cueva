import { Platform } from 'react-native';

const ROUTE_KEY = 'waitomo_web_auth_route_v1';

const ENTRY_ROUTES = new Set([
  'Splash',
  'WelcomeGlobal',
  'WelcomeClientJoin',
  'Welcome',
  'WelcomeScreen',
  'WelcomeDualChoice',
  'WelcomeOrganization',
  'WelcomeOrganizationScreen',
  'Login',
  'LoginScreen',
  'JoinWithInvite',
  'PublicDirectory',
  'Directory',
  'RegistroOwner',
  'TrialSignup',
  'ConfiguraTuEspacio',
  'FitEngineSpaceIntro',
  'RegistroInicial',
  'CreaCuentaStaff',
  'CreaCuentaStaffScreen',
]);

function sessionStorageSafe() {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return null;
  return sessionStorage;
}

/** Guarda la última pantalla autenticada para restaurar tras F5 (solo web). */
export function saveWebAuthRouteForUser(userId, routeName, params) {
  const ss = sessionStorageSafe();
  const uid = userId && String(userId).trim();
  const name = routeName && String(routeName).trim();
  if (!ss || !uid || !name || ENTRY_ROUTES.has(name)) return;
  try {
    ss.setItem(
      ROUTE_KEY,
      JSON.stringify({
        userId: uid,
        name,
        params: params && typeof params === 'object' ? params : undefined,
        ts: Date.now(),
      }),
    );
  } catch (_) {
    // sin-op
  }
}

export function readWebAuthRouteForUser(userId) {
  const ss = sessionStorageSafe();
  const uid = userId && String(userId).trim();
  if (!ss || !uid) return null;
  try {
    const raw = ss.getItem(ROUTE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.userId !== uid || !parsed?.name || ENTRY_ROUTES.has(parsed.name)) return null;
    const age = Date.now() - (Number(parsed.ts) || 0);
    if (age > 7 * 24 * 60 * 60 * 1000) return null;
    return { name: parsed.name, params: parsed.params };
  } catch (_) {
    return null;
  }
}

export function clearWebAuthRoute() {
  const ss = sessionStorageSafe();
  if (!ss) return;
  try {
    ss.removeItem(ROUTE_KEY);
  } catch (_) {
    // sin-op
  }
}

/** Pantalla autenticada (no entrada pública): requiere perfil alineado con la sesión. */
export function isProtectedAuthRoute(routeName) {
  const name = routeName && String(routeName).trim();
  if (!name) return false;
  return !ENTRY_ROUTES.has(name);
}

/** JWT con fila `profiles` del mismo usuario (evita rutas guardadas / panel “fantasma”). */
export function isSessionProfileAligned(userId, profile) {
  const uid = userId && String(userId).trim();
  if (!uid) return true;
  if (!profile?.id) return false;
  return String(profile.id) === uid;
}
