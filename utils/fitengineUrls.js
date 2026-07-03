/**
 * URLs canónicas FitEngine / Waitomo (fuente: app.json → expo.extra + overrides por env en CI).
 *
 * - linksBaseUrl: enlaces de app (invitaciones, trial) en app.fitengine.app
 * - webAppUrl: app web en app.fitengine.app
 * - marketingSiteUrl: landing pública en fitengine.app
 */
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function stripTrailingSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

function pick(extraKey, envKey, fallback) {
  try {
    const fromEnv =
      typeof process !== 'undefined' && process.env?.[envKey] ? String(process.env[envKey]).trim() : '';
    if (fromEnv) return stripTrailingSlash(fromEnv);
  } catch (_) {
    /* ignore */
  }
  const raw = Constants.expoConfig?.extra?.[extraKey];
  if (raw != null && String(raw).trim()) return stripTrailingSlash(String(raw).trim());
  return stripTrailingSlash(fallback);
}

export function getFitEngineUrls() {
  const marketing = pick(
    'fitengineMarketingSiteUrl',
    'EXPO_PUBLIC_FITENGINE_MARKETING_SITE_URL',
    'https://fitengine.app',
  );
  return {
    linksBaseUrl: pick(
      'fitengineLinksBaseUrl',
      'EXPO_PUBLIC_FITENGINE_LINKS_BASE_URL',
      'https://app.fitengine.app',
    ),
    webAppUrl: pick('fitengineWebAppUrl', 'EXPO_PUBLIC_FITENGINE_WEB_APP_URL', 'https://app.fitengine.app'),
    marketingSiteUrl: marketing,
    /** Privacidad / términos: por defecto sitio marketing; cambiar en app.json cuando existan /privacidad /terminos. */
    privacyUrl: pick('fitenginePrivacyUrl', 'EXPO_PUBLIC_FITENGINE_PRIVACY_URL', marketing),
    termsUrl: pick('fitengineTermsUrl', 'EXPO_PUBLIC_FITENGINE_TERMS_URL', marketing),
    /** Opcional en app.json; vacío = ocultar fila de contacto en Acerca de. */
    supportEmail: pick('fitengineSupportEmail', 'EXPO_PUBLIC_FITENGINE_SUPPORT_EMAIL', ''),
    /** Teléfono para reclamos / consultas (opcional). Formato libre; en la app se usa tel: sin espacios. */
    supportPhone: pick('fitengineSupportPhone', 'EXPO_PUBLIC_FITENGINE_SUPPORT_PHONE', ''),
    /** Vacío hasta publicar en tiendas; se añade al mensaje de invitación si está configurado. */
    iosAppStoreUrl: pick(
      'fitengineIosAppStoreUrl',
      'EXPO_PUBLIC_FITENGINE_IOS_APP_STORE_URL',
      '',
    ),
    androidPlayStoreUrl: pick(
      'fitengineAndroidPlayStoreUrl',
      'EXPO_PUBLIC_FITENGINE_ANDROID_PLAY_STORE_URL',
      '',
    ),
  };
}

/** Enlace HTTPS para invitaciones de clientes (mismo path que el deep link waitomo://join). */
export function buildClientInvitePublicLink(code) {
  const c = String(code || '').trim();
  if (!c) return '';
  const { linksBaseUrl } = getFitEngineUrls();
  return `${linksBaseUrl}/join?code=${encodeURIComponent(c)}`;
}

/** Deep link nativo (app instalada). */
export function buildClientInviteNativeLink(code) {
  const c = String(code || '').trim();
  if (!c) return '';
  return `waitomo://join?code=${encodeURIComponent(c)}`;
}

/**
 * OAuth redirect por plataforma (debe coincidir con “Redirect URLs” en Supabase):
 * - Nativo: `waitomo://auth/callback`
 * - Web: mismo origen que la pestaña (`window.location.origin` + `/`), ej. `https://app.fitengine.app/` o `http://localhost:8081/`.
 */
export function getOAuthRedirectUriForSupabase() {
  if (Platform.OS === 'web') {
    // Siempre el mismo origen donde está abierta la app: Google vuelve acá y el
    // code_verifier PKCE queda en el localStorage de ESTE origen (no mezclar hosts).
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${String(window.location.origin).replace(/\/+$/, '')}/`;
    }
    const { webAppUrl } = getFitEngineUrls();
    return `${String(webAppUrl).replace(/\/+$/, '')}/`;
  }
  return 'waitomo://auth/callback';
}

function getWebPaymentConnectReturnOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${String(window.location.origin).replace(/\/+$/, '')}/`;
  }
  return AuthSession.makeRedirectUri({ path: '/' });
}

/** Mismo patrón que OAuth: Stripe Connect vuelve acá y `openAuthSessionAsync` cierra el in-app browser. */
export function getStripeConnectRedirectUri() {
  if (Platform.OS === 'web') {
    return getWebPaymentConnectReturnOrigin();
  }
  return 'waitomo://stripe-connect';
}

/** OAuth MP vendedor: mismo patrón que Stripe (openAuthSessionAsync). */
export function getMercadoPagoConnectRedirectUri() {
  if (Platform.OS === 'web') {
    return getWebPaymentConnectReturnOrigin();
  }
  return 'waitomo://mercadopago-connect';
}
