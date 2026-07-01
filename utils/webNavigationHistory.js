import { Platform } from 'react-native';
import { navigationRef } from '../navigationRef';

const GUARD_FLAG = 'fitengine_spa_history_guard_v1';

const ENTRY_ROUTE_NAMES = new Set([
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

let installed = false;

export function pushWebSpaHistoryEntry(routeName) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!routeName || ENTRY_ROUTE_NAMES.has(routeName)) return;
  try {
    const href = window.location.href;
    const url = new URL(href);
    if (url.searchParams.has('mercadopago_connect') || url.searchParams.has('stripe_connect')) return;
    window.history.pushState({ [GUARD_FLAG]: 1, route: routeName }, '', href);
  } catch (_) {
    try {
      window.history.pushState({ [GUARD_FLAG]: 1, route: routeName }, '');
    } catch (_) {
      /* ignore */
    }
  }
}

/**
 * En web, la flecha Atrás del navegador recorre el historial del browser (OAuth, MP, etc.),
 * no el stack de React Navigation. Empujamos un estado extra y en popstate intentamos volver
 * dentro de la app con navigation.goBack() en lugar de salir del SPA.
 */
export function initWebNavigationHistoryGuard() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || installed) return;
  installed = true;

  try {
    const routeName = navigationRef.isReady?.() ? navigationRef.getCurrentRoute()?.name : '';
    pushWebSpaHistoryEntry(routeName || 'App');
  } catch (_) {
    try {
      window.history.pushState({ [GUARD_FLAG]: 1 }, '');
    } catch (_) {
      /* ignore */
    }
  }

  window.addEventListener('popstate', () => {
    if (!navigationRef.isReady()) return;
    const routeName = navigationRef.getCurrentRoute()?.name || '';
    if (ENTRY_ROUTE_NAMES.has(routeName)) return;
    try {
      if (navigationRef.canGoBack?.()) {
        navigationRef.goBack();
      }
    } catch (_) {
      /* ignore */
    }
    try {
      const nextRoute = navigationRef.getCurrentRoute()?.name || routeName;
      pushWebSpaHistoryEntry(nextRoute);
    } catch (_) {
      /* ignore */
    }
  });
}
