import { resetNavigationRoot } from '../navigationRef';

/** Reset de pila con fallback al ref global (web Safari a veces ignora navigation.reset local). */
export function resetToRoute(navigation, routeName, params) {
  const state = {
    index: 0,
    routes: [{ name: routeName, ...(params !== undefined ? { params } : {}) }],
  };
  try {
    navigation.reset(state);
    return true;
  } catch (_) {
    /* ignore */
  }
  if (resetNavigationRoot(state)) return true;
  try {
    navigation.navigate(routeName, params);
    return true;
  } catch (_) {
    return false;
  }
}
