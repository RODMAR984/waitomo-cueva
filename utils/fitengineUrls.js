/**
 * URLs canónicas FitEngine / Waitomo (fuente: app.json → expo.extra + overrides por env en CI).
 *
 * - linksBaseUrl: enlaces cortos e invitaciones (HTTPS público; canonical apex fitengine.app)
 * - webAppUrl: app web en app.fitengine.app
 * - marketingSiteUrl: sitio informativo waitomofitengine.com
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
    'https://waitomofitengine.com',
  );
  return {
    linksBaseUrl: pick(
      'fitengineLinksBaseUrl',
      'EXPO_PUBLIC_FITENGINE_LINKS_BASE_URL',
      'https://fitengine.app',
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
 * OAuth redirect por plataforma:
 * - Nativo (Android/iOS): deep link `waitomo://auth/callback` para volver a la app.
 * - Web: callback HTTPS en `fitengine.app`.
 */
export function getOAuthRedirectUriForSupabase() {
  if (Platform.OS === 'web') {
    const { linksBaseUrl } = getFitEngineUrls();
    return `${linksBaseUrl}/auth/callback`;
  }
  return 'waitomo://auth/callback';
}

/** Mismo patrón que OAuth: Stripe Connect vuelve acá y `openAuthSessionAsync` cierra el in-app browser. */
export function getStripeConnectRedirectUri() {
  if (Platform.OS === 'web') {
    return AuthSession.makeRedirectUri({ path: 'stripe-connect' });
  }
  return 'waitomo://stripe-connect';
}
