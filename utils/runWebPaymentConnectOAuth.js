const INFLIGHT_MP_KEY = 'waitomo_mp_connect_inflight_v1';
const INFLIGHT_STRIPE_KEY = 'waitomo_stripe_connect_inflight_v1';

/**
 * OAuth de pagos en web: misma pestaña (evita popup en app.fitengine.app sin sesión).
 * Al volver, AppShellContent + pantalla admin leen ?mercadopago_connect=done / stripe.
 */
export function startWebPaymentConnectOAuthSameTab(oauthUrl, kind) {
  if (typeof window === 'undefined' || !oauthUrl) return false;
  const key = kind === 'stripe' ? INFLIGHT_STRIPE_KEY : INFLIGHT_MP_KEY;
  try {
    sessionStorage.setItem(key, String(Date.now()));
  } catch (_) {
    /* ignore */
  }
  window.location.assign(oauthUrl);
  return true;
}

export function clearWebPaymentConnectInflight(kind) {
  if (typeof sessionStorage === 'undefined') return;
  const key = kind === 'stripe' ? INFLIGHT_STRIPE_KEY : INFLIGHT_MP_KEY;
  try {
    sessionStorage.removeItem(key);
  } catch (_) {
    /* ignore */
  }
}
