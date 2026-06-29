import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTrainingData } from '../contexts/TrainingDataContext';
import { useLocale } from '../contexts/LocaleContext';
import { confirmMpCheckoutOnServer } from '../services/billing/confirmMpCheckout';
import { showAppAlert } from '../utils/confirmAction';
import { trackEvent } from '../utils/observability';
import { resetNavigationRoot } from '../navigationRef';
import {
  consumePendingMpCheckoutReturn,
  parseMpCheckoutReturnFromWindow,
  stashPendingMpCheckoutReturn,
  stripMpCheckoutQueryFromHistory,
} from '../utils/mpCheckoutWebReturn';

/**
 * Procesa el retorno de Mercado Pago en web: confirma pago, activa abono y lleva al panel cliente.
 */
export default function MpCheckoutReturnHandler() {
  const { user, organization, profile, authBootstrapReady, refreshProfile } = useAuth() || {};
  const { refreshTrainingBlocksFromServer } = useTrainingData() || {};
  const { t: tStr } = useLocale();
  const parsedRef = useRef(false);
  const handledRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const parsed = parseMpCheckoutReturnFromWindow();
    if (!parsed || parsedRef.current) return;
    parsedRef.current = true;
    stripMpCheckoutQueryFromHistory();
    stashPendingMpCheckoutReturn(parsed);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!user?.id || authBootstrapReady !== true) return;
    if (handledRef.current) return;

    const pending = consumePendingMpCheckoutReturn();
    if (!pending) return;

    const collectionStatus = String(pending.collectionStatus || pending.statusHint || '').toLowerCase();
    const paymentId = String(pending.paymentId || '').trim();
    const orgId = organization?.id || profile?.organization_id || null;

    if (collectionStatus === 'pending') {
      handledRef.current = true;
      showAppAlert(tStr('pago_mp_pending_title'), tStr('pago_mp_pending_body'));
      return;
    }

    if (collectionStatus && collectionStatus !== 'approved') {
      handledRef.current = true;
      showAppAlert(tStr('pago_mp_failed_title'), tStr('pago_mp_failed_body'));
      return;
    }

    if (!paymentId) {
      handledRef.current = true;
      showAppAlert(tStr('pago_mp_return_title'), tStr('pago_mp_return_body'));
      return;
    }

    handledRef.current = true;
    trackEvent('pago_mp_return_received', { has_payment_id: true });

    (async () => {
      try {
        const result = await confirmMpCheckoutOnServer({
          paymentId,
          organizationId: orgId,
          collectionStatus: collectionStatus || 'approved',
        });

        if (!result?.ok) {
          showAppAlert(tStr('pago_mp_pending_title'), tStr('pago_mp_return_body'));
          return;
        }

        trackEvent('pago_mp_return_confirmed', {
          plan_key: result?.plan_id || null,
        });

        if (typeof refreshProfile === 'function') {
          try {
            await refreshProfile();
          } catch {
            /* no fatal */
          }
        }

        if (typeof refreshTrainingBlocksFromServer === 'function') {
          try {
            await refreshTrainingBlocksFromServer();
          } catch {
            /* no fatal */
          }
        }

        showAppAlert(tStr('pago_mp_success_title'), tStr('pago_mp_success_body'));

        resetNavigationRoot({
          index: 0,
          routes: [{ name: 'ClientTabs' }],
        });
      } catch (e) {
        trackEvent('pago_mp_return_confirm_error', { message: String(e?.message || e) });
        showAppAlert(tStr('pago_mp_return_title'), tStr('pago_mp_return_body'));
      }
    })();
  }, [
    user?.id,
    authBootstrapReady,
    organization?.id,
    profile?.organization_id,
    profile?.plan_actual,
    refreshProfile,
    refreshTrainingBlocksFromServer,
    tStr,
  ]);

  return null;
}
