import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { getFitEngineUrls } from './fitengineUrls';

const PENDING_MP_KEY = 'waitomo_mp_connect_pending_v1';
const PENDING_STRIPE_KEY = 'waitomo_stripe_connect_pending_v1';

/** Orígenes HTTPS/HTTP permitidos para volver del OAuth de pagos (edge functions). */
export function isAllowedPaymentConnectWebReturnUrl(raw) {
  const s = String(raw || '').trim();
  if (!s || s.length > 512) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host === 'fitengine.app' || host.endsWith('.fitengine.app')) return true;
    if (host.endsWith('.vercel.app')) return true;
    const { linksBaseUrl, webAppUrl } = getFitEngineUrls();
    for (const base of [linksBaseUrl, webAppUrl]) {
      try {
        if (host === new URL(base).hostname.toLowerCase()) return true;
      } catch (_) {
        /* ignore */
      }
    }
    return false;
  } catch (_) {
    return false;
  }
}

function getPaymentConnectWebReturnUri(pathSegment) {
  if (Platform.OS !== 'web') return '';
  const path = String(pathSegment || '').replace(/^\/+/, '');
  // Mismo origen que la pestaña abierta (fitengine.app vs app.fitengine.app); no app.json.
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = String(window.location.origin).replace(/\/+$/, '');
    return `${origin}/${path}`;
  }
  return AuthSession.makeRedirectUri({ path });
}

export function getMercadoPagoWebReturnUri() {
  return getPaymentConnectWebReturnUri('mercadopago-connect');
}

export function getStripeConnectWebReturnUri() {
  return getPaymentConnectWebReturnUri('stripe-connect');
}

function readSearchParams() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search || '');
  } catch (_) {
    return null;
  }
}

/**
 * @returns {{ kind: 'mercadopago'|'stripe', status: string, reason?: string } | null}
 */
export function parsePaymentConnectReturnFromWindow() {
  const qs = readSearchParams();
  if (!qs) return null;
  const mpDone = qs.get('mercadopago_connect');
  const stDone = qs.get('stripe_connect');
  if (mpDone === 'done') {
    return {
      kind: 'mercadopago',
      status: String(qs.get('status') || '').trim() || 'error',
      reason: String(qs.get('reason') || '').trim() || undefined,
    };
  }
  if (stDone === 'done') {
    return {
      kind: 'stripe',
      status: String(qs.get('status') || '').trim() || 'error',
      reason: String(qs.get('reason') || '').trim() || undefined,
    };
  }
  return null;
}

export function stripPaymentConnectQueryFromHistory() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const qs = url.searchParams;
    let changed = false;
    for (const key of [
      'mercadopago_connect',
      'stripe_connect',
      'status',
      'reason',
      'account_id',
    ]) {
      if (qs.has(key)) {
        qs.delete(key);
        changed = true;
      }
    }
    if (!changed) return;
    const next = `${url.origin}${url.pathname}${qs.toString() ? `?${qs}` : ''}${url.hash || ''}`;
    window.history.replaceState({}, document.title, next);
  } catch (_) {
    /* ignore */
  }
}

export function stashPendingPaymentConnectResult(result) {
  if (!result?.kind) return;
  const ss = Platform.OS === 'web' && typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  if (!ss) return;
  const key = result.kind === 'mercadopago' ? PENDING_MP_KEY : PENDING_STRIPE_KEY;
  try {
    ss.setItem(key, JSON.stringify({ ...result, ts: Date.now() }));
  } catch (_) {
    /* ignore */
  }
}

export function consumePendingPaymentConnectResult(kind) {
  const ss = Platform.OS === 'web' && typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  if (!ss) return null;
  const key = kind === 'mercadopago' ? PENDING_MP_KEY : PENDING_STRIPE_KEY;
  try {
    const raw = ss.getItem(key);
    ss.removeItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.kind !== kind) return null;
    if (Date.now() - (Number(parsed.ts) || 0) > 10 * 60 * 1000) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function paymentConnectRouteForKind(kind) {
  return kind === 'mercadopago' ? 'AdminMercadoPagoSettings' : 'AdminStripeSettings';
}
