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
