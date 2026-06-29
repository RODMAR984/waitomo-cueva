import { Platform } from 'react-native';
import { getFitEngineUrls } from './fitengineUrls';

const PENDING_KEY = 'waitomo_mp_checkout_return_v1';

function readSearchParams() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search || '');
  } catch {
    return null;
  }
}

/**
 * @returns {{ paymentId: string, collectionStatus: string, externalReference?: string, statusHint?: string } | null}
 */
export function parseMpCheckoutReturnFromWindow() {
  const qs = readSearchParams();
  if (!qs) return null;
  if (qs.get('mp_checkout') !== 'return') return null;

  const paymentId = String(qs.get('payment_id') || qs.get('collection_id') || '').trim();
  const collectionStatus = String(
    qs.get('collection_status') || qs.get('status') || '',
  )
    .trim()
    .toLowerCase();
  const externalReference = String(qs.get('external_reference') || '').trim() || undefined;
  const statusHint = String(qs.get('status') || '').trim().toLowerCase() || undefined;

  if (!paymentId && collectionStatus !== 'approved' && statusHint !== 'approved') {
    return {
      paymentId: '',
      collectionStatus: collectionStatus || statusHint || 'unknown',
      externalReference,
      statusHint,
    };
  }

  return {
    paymentId,
    collectionStatus: collectionStatus || statusHint || '',
    externalReference,
    statusHint,
  };
}

export function stripMpCheckoutQueryFromHistory() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const qs = url.searchParams;
    const keys = [
      'mp_checkout',
      'status',
      'collection_id',
      'collection_status',
      'payment_id',
      'external_reference',
      'payment_type',
      'merchant_order_id',
      'preference_id',
    ];
    let changed = false;
    for (const key of keys) {
      if (qs.has(key)) {
        qs.delete(key);
        changed = true;
      }
    }
    if (!changed) return;
    const next = `${url.origin}${url.pathname}${qs.toString() ? `?${qs}` : ''}${url.hash || ''}`;
    window.history.replaceState({}, document.title, next);
  } catch {
    /* ignore */
  }
}

export function stashPendingMpCheckoutReturn(payload) {
  if (!payload) return;
  const ss = Platform.OS === 'web' && typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  if (!ss) return;
  try {
    ss.setItem(PENDING_KEY, JSON.stringify({ ...payload, ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function consumePendingMpCheckoutReturn() {
  const ss = Platform.OS === 'web' && typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  if (!ss) return null;
  try {
    const raw = ss.getItem(PENDING_KEY);
    ss.removeItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - (Number(parsed.ts) || 0) > 15 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function peekPendingMpCheckoutReturn() {
  const ss = Platform.OS === 'web' && typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  if (!ss) return null;
  try {
    const raw = ss.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - (Number(parsed.ts) || 0) > 15 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getCheckoutBackUrlBase() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const host = String(window.location.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')) {
      return String(window.location.origin).replace(/\/+$/, '');
    }
    if (host === 'fitengine.app' || host.endsWith('.fitengine.app')) {
      return String(window.location.origin).replace(/\/+$/, '');
    }
  }
  const { linksBaseUrl, webAppUrl } = getFitEngineUrls();
  return linksBaseUrl || webAppUrl || 'https://fitengine.app';
}
