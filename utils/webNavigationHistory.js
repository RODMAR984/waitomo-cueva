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
  'ConfiguraTuEspacio',
  'FitEngineSpaceIntro',
  'RegistroInicial',
  'CreaCuentaStaff',
  'CreaCuentaStaffScreen',
]);

let installed = false;

/**
 * En web, la flecha Atrás del navegador recorre el historial del browser (OAuth, MP, etc.),
 * no el stack de React Navigation. Empujamos un estado extra y en popstate intentamos volver
 * dentro de la app con navigation.goBack() en lugar de salir del SPA.
 */
export function initWebNavigationHistoryGuard() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || installed) return;
  installed = true;

  try {
    window.history.pushState({ [GUARD_FLAG]: 1 }, '');
  } catch (_) {
    /* ignore */
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
      window.history.pushState({ [GUARD_FLAG]: 1 }, '');
    } catch (_) {
      /* ignore */
    }
  });
}
