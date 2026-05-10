import { Platform } from 'react-native';

/** Ruta hoja activa (último navigator anidado). */
export function getDeepestRouteName(state) {
  if (!state || typeof state.index !== 'number' || !Array.isArray(state.routes)) return null;
  const r = state.routes[state.index];
  if (r?.state) return getDeepestRouteName(r.state);
  return r?.name ?? null;
}

/**
 * Pestaña del navegador (solo web). `tStr` = useLocale().t
 */
export function applyWebDocumentTitle(navigationState, tStr) {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof tStr !== 'function') return;
  const name = getDeepestRouteName(navigationState);
  const keyMap = {
    Panel: 'web_doc_title_client',
    ClientScreen: 'web_doc_title_client',
    Calendario: 'web_doc_title_calendario',
    Directory: 'web_doc_title_directory',
    Perfil: 'web_doc_title_profile',
    Chat: 'web_doc_title_chat',
    TrabajoDelDia: 'web_doc_title_trabajo',
    Admin: 'web_doc_title_admin',
    AdminLite: 'web_doc_title_admin',
    WelcomeGlobal: 'web_doc_title_welcome',
    WelcomeClientJoin: 'web_doc_title_welcome',
    Splash: 'web_doc_title_welcome',
    Login: 'web_doc_title_login',
    Novedades: 'web_doc_title_novedades',
  };
  const mapKey = keyMap[name];
  const suffix = mapKey ? tStr(mapKey) : name ? String(name) : '';
  const app = tStr('web_doc_title_app');
  document.title = suffix ? `${app} · ${suffix}` : app;
}
