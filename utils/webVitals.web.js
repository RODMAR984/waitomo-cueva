/**
 * RUM web: Core Web Vitals (carga diferida de `web-vitals`) + cola local + RUM anónimo opcional.
 */
import Constants from 'expo-constants';
import { trackEvent } from './observability';
import { flushObservabilityEventsIfNeeded } from './observabilityFlush';
import { enqueueWebRumAnonEvent, flushWebRumAnonNow } from './rumAnonEnqueue';

function bootMeta() {
  try {
    return {
      appVersion: Constants.expoConfig?.version || null,
      sdkVersion: Constants.expoConfig?.sdkVersion || null,
    };
  } catch (_) {
    return {};
  }
}

function wireVitals(wv, meta) {
  const sendMs = (name, metric) => {
    const row = {
      durationMs: Math.round(metric.value),
      rating: metric.rating || null,
      metricId: metric.id || null,
      navigationType: metric.navigationType || null,
      ...meta,
    };
    trackEvent(name, row);
    enqueueWebRumAnonEvent({ name, ts: new Date().toISOString(), payload: row });
  };

  wv.onLCP((m) => sendMs('web_vital_lcp', m));
  wv.onFCP((m) => sendMs('web_vital_fcp', m));
  wv.onTTFB((m) => sendMs('web_vital_ttfb', m));
  wv.onINP((m) => sendMs('web_vital_inp', m));

  wv.onCLS((m) => {
    const row = {
      cls: Number(Number(m.value).toFixed(4)),
      rating: m.rating || null,
      metricId: m.id || null,
      navigationType: m.navigationType || null,
      ...meta,
    };
    trackEvent('web_vital_cls', row);
    enqueueWebRumAnonEvent({ name: 'web_vital_cls', ts: new Date().toISOString(), payload: row });
  });
}

export function initWebVitalsReporting() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const meta = bootMeta();
  trackEvent('web_app_boot', { platform: 'web', ...meta });
  enqueueWebRumAnonEvent({
    name: 'web_app_boot',
    ts: new Date().toISOString(),
    payload: { platform: 'web', ...meta },
  });

  import('web-vitals')
    .then((wv) => {
      wireVitals(wv, meta);
    })
    .catch(() => {
      /* sin web-vitals */
    });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      trackEvent('web_visibility_hidden', { ...meta });
      flushObservabilityEventsIfNeeded({ force: true }).catch(() => undefined);
      void flushWebRumAnonNow();
    }
  });
}
