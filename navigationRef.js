import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

// Ref de navegación global para poder hacer reset desde cualquier lugar
export const navigationRef = createNavigationContainerRef();

/**
 * Resetea el árbol raíz. `createNavigationContainerRef()` no expone `resetRoot` (era un nombre erróneo);
 * el API soportado es `dispatch(CommonActions.reset(...))`.
 * @param {{ index: number, routes: Array<{ name: string, params?: object }> }} state
 * @returns {boolean} true si se despachó el reset
 */
export function resetNavigationRoot(state) {
  if (!navigationRef.isReady()) return false;
  try {
    navigationRef.dispatch(CommonActions.reset(state));
    return true;
  } catch {
    return false;
  }
}

/** Estado raíz canónico post-logout / invitado. */
export const WELCOME_GLOBAL_ROOT_STATE = Object.freeze({
  index: 0,
  routes: [{ name: 'WelcomeGlobal' }],
});

/**
 * Tras `logout`, `navigationRef.isReady()` a veces sigue en false en el primer microtask:
 * `resetNavigationRoot` no hace nada y la pila queda en staff/cliente con `session=null` → pantalla en blanco.
 * Reintenta con `requestAnimationFrame` hasta que el `NavigationContainer` esté listo o se agote el tiempo.
 *
 * @param {{ maxWaitMs?: number }} [options]
 * @returns {Promise<boolean>} true si se despachó el reset
 */
export function resetNavigationRootToWelcome(options = {}) {
  const maxWaitMs = typeof options.maxWaitMs === 'number' ? options.maxWaitMs : 8000;
  const started = Date.now();

  const tryOnce = () => {
    if (resetNavigationRoot(WELCOME_GLOBAL_ROOT_STATE)) return 'ok';
    if (Date.now() - started >= maxWaitMs) return 'fail';
    return 'retry';
  };

  const first = tryOnce();
  if (first === 'ok') return Promise.resolve(true);
  if (first === 'fail') {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn('resetNavigationRootToWelcome: navigationRef not ready after', maxWaitMs, 'ms');
    }
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const step = () => {
      const r = tryOnce();
      if (r === 'ok') {
        resolve(true);
        return;
      }
      if (r === 'fail') {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn('resetNavigationRootToWelcome: gave up after', maxWaitMs, 'ms');
        }
        resolve(false);
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
