import React, { useEffect, useMemo, useRef } from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { PlanProvider } from '../contexts/PlanContext';
import { TrainingDataProvider } from '../contexts/TrainingDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { reportError, setObservabilityContext, trackEvent } from '../utils/observability';
import { applyWebDocumentTitle } from '../utils/webDocumentTitle';
import { syncSentryUserContext } from '../utils/sentryWebClient';
import { flushObservabilityEventsIfNeeded } from '../utils/observabilityFlush';
import { navigationRef } from '../navigationRef';
import {
  isSessionProfileAligned,
  saveWebAuthRouteForUser,
} from '../utils/webAuthRoutePersistence';
import {
  parsePaymentConnectReturnFromWindow,
  paymentConnectRouteForKind,
  peekPendingPaymentConnectResult,
  stashPendingPaymentConnectResult,
  stripPaymentConnectQueryFromHistory,
} from '../utils/paymentConnectWebReturn';
import { initWebNavigationHistoryGuard, pushWebSpaHistoryEntry } from '../utils/webNavigationHistory';
import { resetNavigationRoot } from '../navigationRef';

import AppRootStack from './AppRootStack';
import ClientInviteLinkHandler from '../components/ClientInviteLinkHandler';
import MpCheckoutReturnHandler from '../components/MpCheckoutReturnHandler';
import AuthGate from '../components/AuthGate';

/**
 * Navegación + providers de dominio inmediato (plan / training) bajo el árbol de auth ya resuelto arriba en App.js.
 */
export default function AppShellContent() {
  const { user, profile, role, organization, initialProfileSyncDone, authBootstrapReady } =
    useAuth() || {};
  const { theme, t } = useThemeContext();
  const { t: tStr } = useLocale();
  const routeNameRef = useRef(null);
  const ROUTING_DEBUG = __DEV__;

  useEffect(() => {
    const ctx = {
      userId: user?.id || null,
      role: role || null,
      organizationId: organization?.id || null,
    };
    setObservabilityContext(ctx);
    syncSentryUserContext(ctx);
  }, [user?.id, role, organization?.id]);

  useEffect(() => {
    trackEvent('app_content_mounted', { platform: Platform.OS });
    initWebNavigationHistoryGuard();
  }, []);

  const paymentConnectHandledRef = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const parsed = parsePaymentConnectReturnFromWindow();
    if (!parsed || paymentConnectHandledRef.current) return;
    paymentConnectHandledRef.current = true;
    stripPaymentConnectQueryFromHistory();
    stashPendingPaymentConnectResult(parsed);
  }, []);

  const paymentConnectNavDoneRef = useRef(false);
  useEffect(() => {
    if (!user?.id) paymentConnectNavDoneRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!user?.id || authBootstrapReady !== true) return;
    if (paymentConnectNavDoneRef.current) return;

    let pending = null;
    for (const kind of ['stripe', 'mercadopago']) {
      pending = peekPendingPaymentConnectResult(kind);
      if (pending) break;
    }
    if (!pending) return;

    const targetRoute = paymentConnectRouteForKind(pending.kind);

    const attempt = () => {
      if (!navigationRef.isReady()) return false;
      const ok = resetNavigationRoot({
        index: 0,
        routes: [{ name: targetRoute }],
      });
      if (ok) paymentConnectNavDoneRef.current = true;
      return ok;
    };

    if (attempt()) return undefined;

    const id = setInterval(() => {
      if (attempt()) clearInterval(id);
    }, 80);
    return () => clearInterval(id);
  }, [user?.id, authBootstrapReady]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const run = () => {
      flushObservabilityEventsIfNeeded({ force: false }).catch(() => undefined);
    };
    run();
    const id = setInterval(run, 60000);
    return () => clearInterval(id);
  }, [user?.id]);

  useEffect(() => {
    if (!global.ErrorUtils || typeof global.ErrorUtils.getGlobalHandler !== 'function') return undefined;
    const prev = global.ErrorUtils.getGlobalHandler();
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      reportError('global_js_error', error, { isFatal: !!isFatal });
      if (typeof prev === 'function') prev(error, isFatal);
    });
    return () => {
      if (typeof prev === 'function') global.ErrorUtils.setGlobalHandler(prev);
    };
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerTitleText: { color: t.text, fontWeight: '700' },
      }),
    [t],
  );

  const defaultScreenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: {
        backgroundColor: 'transparent',
        ...(Platform.OS === 'web' ? { flex: 1, minHeight: 0 } : null),
      },
      headerStyle: {
        backgroundColor: t.overlayBg,
        borderBottomColor: t.overlayBorder,
      },
      headerTintColor: t.text,
      headerTitle: () => <Text style={styles.headerTitleText}>FitEngine</Text>,
    }),
    [t, styles],
  );

  return (
    <PlanProvider>
      <TrainingDataProvider>
        <NavigationContainer
          ref={navigationRef}
          theme={theme}
          linking={undefined}
          onReady={() => {
            const r = navigationRef.getCurrentRoute?.();
            routeNameRef.current = r?.name || null;
            try {
              applyWebDocumentTitle(navigationRef.getRootState?.(), tStr);
            } catch (_) {}
            trackEvent('navigation_ready', { route: r?.name || null });
            if (ROUTING_DEBUG) {
              try {
                // eslint-disable-next-line no-console
                console.log('ROUTING_DEBUG NavigationContainer onReady', {
                  route: r?.name,
                  params: r?.params,
                });
              } catch (_) {}
            }
          }}
          onStateChange={(state) => {
            const r = navigationRef.getCurrentRoute?.();
            const nextName = r?.name || null;
            if (nextName && nextName !== routeNameRef.current) {
              trackEvent('navigation_route_change', {
                from: routeNameRef.current || null,
                to: nextName,
              });
              routeNameRef.current = nextName;
              pushWebSpaHistoryEntry(nextName);
            }
            if (
              Platform.OS === 'web' &&
              user?.id &&
              nextName &&
              initialProfileSyncDone !== false &&
              isSessionProfileAligned(user.id, profile)
            ) {
              saveWebAuthRouteForUser(user.id, nextName, r?.params);
            }
            try {
              applyWebDocumentTitle(state, tStr);
            } catch (_) {}
            try {
              if (ROUTING_DEBUG) {
                // eslint-disable-next-line no-console
                console.log('ROUTING_DEBUG stateChange', {
                  route: r?.name,
                  params: r?.params,
                });
              }
            } catch (_) {}
          }}
        >
          <ClientInviteLinkHandler />
          <MpCheckoutReturnHandler />
          <AuthGate>
            <AppRootStack screenOptions={defaultScreenOptions} registroOwnerBackgroundColor={t.bg} />
          </AuthGate>
        </NavigationContainer>
      </TrainingDataProvider>
    </PlanProvider>
  );
}
