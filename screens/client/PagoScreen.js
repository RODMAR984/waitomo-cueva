// screens/PagoScreen.js — Waitomo Dark Only (FIX definitivo)
// - "Ya pagué" SIEMPRE continúa el flujo (no se clava)
// - ✅ Crea user_abonos (active) + user_plans (legacy) para que ClientScreen detecte plan
// - MercadoPago: si no hay monto, abre igual MP sin romper
// - Mantiene estética y estructura

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import PropTypes from 'prop-types';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

import ScreenShell from '../../components/ScreenShell';
import BackNavButton from '../../components/BackNavButton';
import { useTrainingData } from '../../contexts/TrainingDataContext';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../theme/colors';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { supabase } from '../../supabaseClient';
import { normalizePlanKey } from '../../utils/planKeyNormalize';
import { createCheckoutPreference } from '../../services/billing/mercadoPagoCheckout';
import { createStripeCheckoutSession } from '../../services/billing/stripeCheckout';
import { resolveClientPaymentMethods } from '../../utils/clientPaymentMethods';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import NeoPanel from '../../components/NeoPanel';
import { reportError, trackEvent } from '../../utils/observability';
import { showAppAlert } from '../../utils/confirmAction';

// ---------- helpers ----------
const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

const addDaysISO = (startDate = new Date(), days = 30) => {
  const d = startDate instanceof Date ? new Date(startDate) : new Date(String(startDate));
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(days || 0));
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`; // date
};

const todayISO = () => {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function PagoScreen({ navigation, route }) {
  const { createPayment, markAsPaid } = useTrainingData();
  const { user: ctxUser, updateProfile, organization } = useAuth() || {};
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  const defaultPlan = { id: 'admin', title: 'Pago', nombre: 'admin' };
  const {
    plan = defaultPlan,
    userData,
    abono,
    planKey: routePlanKey,
    skipProfileCompletion = false,
  } = route?.params || {};

  /** En release (EAS) oculto por defecto. En `expo start` (__DEV__) visible. Para probar APK: app.json → extra.showPaidShortcut true */
  const showPaidShortcut =
    (typeof __DEV__ !== 'undefined' && __DEV__) ||
    Constants.expoConfig?.extra?.showPaidShortcut === true;
  const [paymentId, setPaymentId] = useState(null);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [busy, setBusy] = useState(false);

  const userId = userData?.id || ctxUser?.id || null;

  const planId =
    String(
      (typeof plan?.id === 'string' && plan.id) ||
      (typeof plan?.nombre === 'string' && plan.nombre) ||
      (typeof plan?.title === 'string' && plan.title) ||
      routePlanKey ||
      'admin'
    ).toLowerCase().trim();
  const planCanon = normalizePlanKey(planId) || planId;

  const parsePrecio = (v) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      return Number(v.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    }
    return 0;
  };

  // monto puede ser 0 => NO frenamos flujo (priorizar centavos desde BD; evita parse AR "$ 3.000" → 3)
  const monto =
    abono?.price_cents != null && Number.isFinite(Number(abono.price_cents))
      ? Number(abono.price_cents) / 100
      : parsePrecio(abono?.precio) || parsePrecio(userData?.precio ?? plan?.precio ?? 0);
  const periodo = new Date().toISOString().slice(0, 7); // YYYY-MM

  const paymentMethods = useMemo(
    () => resolveClientPaymentMethods(organization?.features),
    [organization?.features],
  );

  useEffect(() => {
    trackEvent('pago_screen_view', {
      plan_key: planCanon,
      has_mp: Boolean(paymentMethods.mercadopago),
      has_stripe: Boolean(
        organization?.stripe_checkout_enabled && organization?.stripe_connect_account_id,
      ),
      has_transfer: Boolean(paymentMethods.transferencia),
      monto_positive: Boolean(typeof monto === 'number' && monto > 0),
    });
  }, [planCanon, organization?.stripe_checkout_enabled, organization?.stripe_connect_account_id, paymentMethods, monto]);
  const stripeReady = !!organization?.stripe_checkout_enabled && !!organization?.stripe_connect_account_id;
  const selectedCurrency = String(organization?.billing_currency || 'ARS').toUpperCase();
  const anyPaymentMethod =
    paymentMethods.mercadopago ||
    paymentMethods.transferencia ||
    paymentMethods.cuenta_dni ||
    paymentMethods.modo ||
    paymentMethods.efectivo;

  const copiarDatos = async (texto) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        await Clipboard.setStringAsync(texto);
      }
    } catch (e) {
      // En web sin permiso de portapapeles igual mostramos los datos en el diálogo.
      console.warn('copiarDatos:', e?.message || e);
    }
    showAppAlert(tStr('pago_copied_title'), `${texto}\n\n${tStr('pago_copied_hint')}`);
  };

  const openCheckoutUrl = async (url, { sameTab = false } = {}) => {
    if (!url) return false;
    const href = String(url);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (sameTab) {
        window.location.assign(href);
        return true;
      }
      const popup = window.open(href, '_blank', 'noopener,noreferrer');
      if (!popup) window.location.assign(href);
      return true;
    }
    if (href.includes('mercadopago') || href.includes('stripe.com')) {
      await WebBrowser.openBrowserAsync(href);
    } else {
      await Linking.openURL(href);
    }
    return true;
  };

  const runWithBusy = async (fn) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const handleManualMethod = async (metodo, copyText) => {
    if (!userId) {
      showAppAlert(tStr('reg_complete_alert_no_session_title'), tStr('reg_complete_alert_no_session_body'));
      return;
    }
    await runWithBusy(async () => {
      try {
        await crearIntentoPago(metodo);
        if (metodo === 'efectivo') {
          showAppAlert(
            tStr('pago_manual_pending_title'),
            `${tStr('pago_cash_alert')}\n\n${tStr('pago_manual_pending_body')}`,
          );
        } else if (copyText) {
          await copiarDatos(copyText);
          showAppAlert(tStr('pago_manual_pending_title'), tStr('pago_manual_pending_body'));
        } else {
          showAppAlert(tStr('pago_manual_pending_title'), tStr('pago_manual_pending_body'));
        }
      } catch (e) {
        reportError('pago_manual_method_error', e, { metodo, plan_key: planCanon });
        showAppAlert(tStr('security_error_title'), tStr('pago_manual_method_err'));
      }
    });
  };

  const crearIntentoPago = async (metodo) => {
    try {
      if (!createPayment) return null;
      if (!userId) throw new Error('Usuario no autenticado');

      // ✅ si no hay monto, NO rompemos (solo no generamos intento)
      if (!(typeof monto === 'number' && monto > 0)) {
        return { paymentId: null, paymentUrl: null };
      }

      const res = createPayment({
        userId,
        planId,
        periodo,
        monto,
        moneda: 'ARS',
        metodo,
        status: 'pendiente',
      });

      const pid =
        (typeof res === 'string' && res) ||
        res?.payment_id ||
        res?.id ||
        res?.paymentId ||
        null;

      let url = res?.init_point || res?.payment_url || res?.url || null;

      if (
        pid &&
        (metodo === 'mercadopago' || metodo === 'mp') &&
        typeof monto === 'number' &&
        monto > 0
      ) {
        try {
          const orgName = String(organization?.name || '').trim();
          const title = orgName
            ? `FitEngine · ${orgName} · ${planCanon}`
            : `FitEngine · ${planCanon}`;
          const { init_point: initPoint } = await createCheckoutPreference({
            amount: monto,
            title,
            externalReference: pid,
            organizationId: organization?.id || null,
            planId: planCanon,
            abonoId: abono?.id || abono?.__row?.id || null,
            periodo,
            durationDays: Number(abono?.duration_days ?? abono?.__row?.duration_days ?? 30) || 30,
            includedSessions: abono?.included_sessions ?? abono?.__row?.included_sessions ?? null,
          });
          url = initPoint;
        } catch (e) {
          console.warn('Checkout Pro MP:', e?.message || e);
          if (String(e?.message || '') === 'mercadopago_checkout_disabled') {
            showAppAlert(tStr('pago_mp_checkout_disabled_title'), tStr('pago_mp_checkout_disabled_msg'));
          }
          url = null;
        }
      }

      setPaymentId(pid);
      setPaymentUrl(url);

      return { paymentId: pid, paymentUrl: url };
    } catch (e) {
      setPaymentId(null);
      setPaymentUrl(null);
      console.log('❌ crearIntentoPago error:', e?.message || e);
      // NO bloqueamos la UI por esto
      return null;
    }
  };

  // ✅ FIX CLAVE: crear abono real para que ClientScreen detecte plan
  const crearAbonoReal = async () => {
    try {
      if (!userId) return;

      const abonoId = abono?.id || abono?.__row?.id || null;
      const durationDays =
        Number(abono?.duration_days ?? abono?.__row?.duration_days ?? 30) || 30;

      const includedSessions =
        abono?.included_sessions ?? abono?.__row?.included_sessions ?? null;

      // user_abonos requiere: abono_id (uuid), plan_id, end_date
      // si por algún motivo abonoId viene null, no podemos insertar (schema lo exige)
      if (!abonoId) {
        console.log('🟠 crearAbonoReal: sin abonoId (uuid) -> no inserto user_abonos');
        return;
      }

      const startDate = todayISO();
      const endDate = addDaysISO(new Date(), durationDays);

      // 1) user_abonos
      const { error: e1 } = await supabase
        .from('user_abonos')
        .insert({
          user_id: userId,
          abono_id: abonoId,
          plan_id: planCanon,
          status: 'active',            // ✅ para destrabar panel inmediatamente
          start_date: startDate,
          end_date: endDate,
          sessions_total: includedSessions,
          sessions_used: 0,
        });

      if (e1) {
        console.log('❌ crearAbonoReal: insert user_abonos error:', e1?.message || e1);
      } else {
        console.log('✅ crearAbonoReal: user_abonos creado', { userId, planId: planCanon, abonoId });
      }

      // 2) legacy: user_plans (por compat)
      try {
        const { error: e2 } = await supabase
          .from('user_plans')
          .insert({
            user_id: userId,
            plan_id: planCanon,
            activo: true,
          });

        if (e2) {
          // no fatal
          console.log('🟠 crearAbonoReal: insert user_plans error (no fatal):', e2?.message || e2);
        }
      } catch (e) {
        console.log('🟠 crearAbonoReal: user_plans catch (no fatal):', e?.message || e);
      }
    } catch (e) {
      console.log('❌ crearAbonoReal catch:', e?.message || e);
    }
  };

  const handlePagoConfirmado = async () => {
    trackEvent('pago_mark_paid_tap', {
      plan_key: planCanon,
      skip_profile_completion: Boolean(skipProfileCompletion),
    });
    // Flujo cliente existente: no pedir completar perfil otra vez.
    if (skipProfileCompletion) {
      await crearAbonoReal();
      if (userId) {
        let updatedPlan = false;
        if (typeof updateProfile === 'function') {
          try {
            await updateProfile({ plan_actual: planCanon });
            updatedPlan = true;
          } catch (e) {
            // fallback below
          }
        }
        if (!updatedPlan) {
          // Fallback defensivo: persistir plan_actual aunque updateProfile falle por estado de contexto.
          try {
            await supabase.from('profiles').update({ plan_actual: planCanon }).eq('id', userId);
          } catch (e) {
            // no fatal: el abono ya fue creado
          }
        }
      }
      if (paymentId && markAsPaid) {
        Promise.resolve()
          .then(() => markAsPaid(paymentId, { metodo: 'confirmado_usuario' }))
          .catch(() => {});
      }
      navigation.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
      return;
    }

    // Flujo legacy / alta nueva: mantener registro completo.
    navigation.navigate('RegistroCompleto', { plan, userData, abono, planKey: planCanon });
    crearAbonoReal();
    if (paymentId && markAsPaid) {
      Promise.resolve()
        .then(() => markAsPaid(paymentId, { metodo: 'confirmado_usuario' }))
        .catch(() => {});
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { backgroundColor: 'transparent', flex: 1 },
        scroll: {
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 16,
          paddingVertical: 40,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        panel: {
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1.2,
          padding: MOBILE_SPACING.xxl,
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
        },
        title: {
          color: t.subText,
          fontSize: MOBILE_TYPE.title,
          fontWeight: 'bold',
          marginBottom: 10,
          textAlign: 'center',
        },
        mpHint: {
          color: t.subText,
          fontSize: MOBILE_TYPE.label,
          lineHeight: 18,
          marginBottom: 16,
          textAlign: 'center',
          opacity: 0.92,
        },
        intlNote: {
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          lineHeight: 17,
          marginBottom: 18,
          textAlign: 'center',
          opacity: 0.88,
        },
        btnPrimary: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: MOBILE_RADII.sm,
          minHeight: MOBILE_SIZES.controlHeightLg,
          marginBottom: 14,
          paddingVertical: MOBILE_SPACING.md,
          paddingHorizontal: MOBILE_SPACING.lg,
          justifyContent: 'center',
        },
        btnTextOn: { ...t.buttonPrimaryText, fontSize: MOBILE_TYPE.bodyStrong },

        btnSecondary: {
          alignItems: 'center',
          backgroundColor: t.faintStrong,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          minHeight: MOBILE_SIZES.controlHeightLg,
          marginBottom: 20,
          paddingVertical: MOBILE_SPACING.md,
          paddingHorizontal: MOBILE_SPACING.lg,
          justifyContent: 'center',
        },
        btnText: { color: t.text, fontWeight: 'bold', fontSize: MOBILE_TYPE.bodyStrong },

        volverWrap: { alignItems: 'center', marginTop: 6 },
        volverText: { color: t.text, fontSize: MOBILE_TYPE.subhead },
        busyOverlay: {
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hexToRgba('#000000', 0.35),
          borderRadius: MOBILE_RADII.lg,
        },
      }),
    [t],
  );

  return (
    <ScreenShell plan={plan}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 20}
        style={styles.root}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <NeoPanel style={styles.panel}>
            <Text style={styles.title}>{tStr('pago_title_select')}</Text>

            {busy ? (
              <View style={styles.busyOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color={t.brand} />
              </View>
            ) : null}

            {!anyPaymentMethod ? (
              <Text style={styles.mpHint}>{tStr('pago_no_methods_configured')}</Text>
            ) : null}

            {paymentMethods.mercadopago ? (
              <>
                <Text style={styles.mpHint}>{tStr('pago_mp_checkout_hint')}</Text>

                <TouchableOpacity
                  style={styles.btnPrimary}
                  disabled={busy}
                  onPress={() =>
                    runWithBusy(async () => {
                      try {
                        if (!userId) {
                          showAppAlert(
                            tStr('reg_complete_alert_no_session_title'),
                            tStr('reg_complete_alert_no_session_body'),
                          );
                          return;
                        }
                        trackEvent('pago_mp_checkout_start', { plan_key: planCanon });
                        if (!(typeof monto === 'number' && monto > 0)) {
                          showAppAlert(
                            tStr('pago_no_price_title'),
                            tStr('pago_no_price_body'),
                          );
                          return;
                        }
                        const r = await crearIntentoPago('mercadopago');
                        const url = r?.paymentUrl;
                        if (url) {
                          trackEvent('pago_mp_checkout_browser_open', { plan_key: planCanon });
                          await openCheckoutUrl(url, { sameTab: Platform.OS === 'web' });
                        } else {
                          trackEvent('pago_mp_checkout_no_url', { plan_key: planCanon });
                          showAppAlert(
                            tStr('pago_mp_checkout_unavailable_title'),
                            tStr('pago_mp_checkout_unavailable_msg'),
                          );
                        }
                      } catch (e) {
                        reportError('pago_mp_checkout_error', e, { plan_key: planCanon });
                        showAppAlert(tStr('security_error_title'), tStr('pago_mp_checkout_err'));
                      }
                    })
                  }
                >
                  <Text style={styles.btnTextOn}>{tStr('pago_btn_mercadopago')}</Text>
                </TouchableOpacity>

                <Text style={styles.intlNote}>{tStr('pago_international_note')}</Text>
              </>
            ) : null}

            {stripeReady ? (
              <>
                <Text style={styles.mpHint}>{tStr('pago_stripe_checkout_hint')}</Text>
                <TouchableOpacity
                  style={styles.btnPrimary}
                  disabled={busy}
                  onPress={() =>
                    runWithBusy(async () => {
                      try {
                        if (!userId) {
                          showAppAlert(
                            tStr('reg_complete_alert_no_session_title'),
                            tStr('reg_complete_alert_no_session_body'),
                          );
                          return;
                        }
                        trackEvent('pago_stripe_checkout_start', { plan_key: planCanon });
                        const result = await createStripeCheckoutSession({
                          organizationId: organization?.id,
                          memberUserId: userId,
                          planId: planCanon,
                          periodo,
                          amount: monto,
                          currency: selectedCurrency,
                          title: `FitEngine · ${planCanon}`,
                        });
                        if (result?.payment_id) setPaymentId(result.payment_id);
                        if (result?.checkout_url) {
                          await openCheckoutUrl(result.checkout_url);
                          trackEvent('pago_stripe_checkout_browser_open', { plan_key: planCanon });
                          showAppAlert(tStr('pago_mp_return_title'), tStr('pago_stripe_return_body'));
                        } else {
                          showAppAlert(
                            tStr('pago_mp_checkout_unavailable_title'),
                            tStr('pago_stripe_checkout_err'),
                          );
                        }
                      } catch (e) {
                        reportError('pago_stripe_checkout_error', e, { plan_key: planCanon });
                        showAppAlert(tStr('security_error_title'), tStr('pago_stripe_checkout_err'));
                      }
                    })
                  }
                >
                  <Text style={styles.btnTextOn}>{tStr('pago_btn_stripe')}</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {paymentMethods.transferencia ? (
              <TouchableOpacity
                style={styles.btnPrimary}
                disabled={busy}
                onPress={() => handleManualMethod('transferencia', paymentMethods.transfer_copy)}
              >
                <Text style={styles.btnTextOn}>{tStr('pago_btn_transfer')}</Text>
              </TouchableOpacity>
            ) : null}

            {paymentMethods.cuenta_dni ? (
              <TouchableOpacity
                style={styles.btnPrimary}
                disabled={busy}
                onPress={() => handleManualMethod('cuenta_dni', paymentMethods.dni_copy)}
              >
                <Text style={styles.btnTextOn}>{tStr('pago_btn_dni')}</Text>
              </TouchableOpacity>
            ) : null}

            {paymentMethods.modo ? (
              <TouchableOpacity
                style={styles.btnPrimary}
                disabled={busy}
                onPress={() => handleManualMethod('modo', paymentMethods.modo_copy)}
              >
                <Text style={styles.btnTextOn}>{tStr('pago_btn_modo')}</Text>
              </TouchableOpacity>
            ) : null}

            {paymentMethods.efectivo ? (
              <TouchableOpacity
                style={styles.btnPrimary}
                disabled={busy}
                onPress={() => handleManualMethod('efectivo')}
              >
                <Text style={styles.btnTextOn}>{tStr('pago_btn_cash')}</Text>
              </TouchableOpacity>
            ) : null}

            {(paymentMethods.transferencia ||
              paymentMethods.cuenta_dni ||
              paymentMethods.modo ||
              paymentMethods.efectivo) ? (
              <>
                {paymentMethods.mercadopago ? (
                  <Text style={styles.mpHint}>{tStr('pago_manual_paid_hint')}</Text>
                ) : null}
                <TouchableOpacity
                  style={styles.btnSecondary}
                  disabled={busy}
                  onPress={() => runWithBusy(handlePagoConfirmado)}
                >
                  <Text style={styles.btnText}>{tStr('pago_btn_paid')}</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {showPaidShortcut ? (
              <Text style={styles.mpHint}>{tStr('pago_dev_shortcut_hint')}</Text>
            ) : null}

            <View style={styles.volverWrap}>
              <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} />
            </View>
          </NeoPanel>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

PagoScreen.propTypes = {
  route: PropTypes.shape({
    params: PropTypes.shape({
      plan: PropTypes.any,
      userData: PropTypes.any,
      abono: PropTypes.any,
    }),
  }),
  navigation: PropTypes.shape({
    navigate: PropTypes.func.isRequired,
    goBack: PropTypes.func.isRequired,
  }).isRequired,
};