// SplashScreen — Logo completo (triangulo + texto). Fondo #050a0d.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { fitengineLogoColors as fe } from '../../theme/colors';
import LogoCompleto from '../../components/LogoCompleto';
import { useLocale } from '../../contexts/LocaleContext';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import { authTrace } from '../../utils/authTrace';
import { parseWebTrialSignupFromWindow } from '../../utils/webAppLinking';
import {
  hasPendingPaymentConnectResult,
  parsePaymentConnectReturnFromWindow,
} from '../../utils/paymentConnectWebReturn';

const SPLASH_DURATION_MS = 1600;
/** Web frío (sin OAuth en URL): salir antes del timer largo de marca; el “peso” está en restore cap ~2.6s. */
const SPLASH_WEB_COLD_MS = 550;

function isWebOAuthReturnUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const q = String(window.location?.search || '');
  if (q.includes('code=')) return true;
  const h = String(window.location?.hash || '');
  return h.includes('code=') || h.includes('access_token=');
}

function isWebPaymentConnectReturnUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const q = String(window.location?.search || '');
  return q.includes('stripe_connect=') || q.includes('mercadopago_connect=');
}

export default function SplashScreen() {
  const navigation = useNavigation();
  const { t: tStr } = useLocale();
  const goneRef = useRef(false);

  useEffect(() => {
    // Vuelta OAuth pagos (Stripe/MP): no mandar a Welcome; AppShellContent resetea a la pantalla admin.
    if (
      Platform.OS === 'web' &&
      (isWebPaymentConnectReturnUrl() ||
        parsePaymentConnectReturnFromWindow() ||
        hasPendingPaymentConnectResult())
    ) {
      authTrace('splash_skip', { reason: 'payment_connect_return' });
      return undefined;
    }

    // OAuth en web: volver con ?code= — no esperar 1.6s para salir del splash (mejor UX y menos sensación de “clavado”).
    const delayMs =
      isWebOAuthReturnUrl() || isWebPaymentConnectReturnUrl()
        ? 80
        : Platform.OS === 'web'
          ? SPLASH_WEB_COLD_MS
          : SPLASH_DURATION_MS;
    const timer = setTimeout(() => {
      if (goneRef.current) return;
      goneRef.current = true;
      const signup = parseWebTrialSignupFromWindow();
      if (signup?.trial) {
        authTrace('splash_replace', { to: 'TrialSignup', delayMs });
        navigation.replace('TrialSignup', { trial: signup.trial });
        return;
      }
      if (signup?.redirectWelcome) {
        authTrace('splash_replace', { to: 'WelcomeGlobal', reason: 'signup_without_trial' });
        navigation.replace('WelcomeGlobal');
        return;
      }
      authTrace('splash_replace', { to: 'WelcomeGlobal', delayMs });
      navigation.replace('WelcomeGlobal');
    }, delayMs);
    return () => clearTimeout(timer);
  }, [navigation]);

  const goToWelcome = () => {
    if (goneRef.current) return;
    goneRef.current = true;
    authTrace('splash_replace', { to: 'WelcomeGlobal', delayMs: 'tap' });
    navigation.replace('WelcomeGlobal');
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={goToWelcome}
      style={[styles.container, { backgroundColor: fe.background }]}
    >
      <View style={styles.center} testID="splash-screen" collapsable={false}>
        <LogoCompleto height={155} style={styles.logo} />
        <Text style={[styles.byWaitomo, { color: fe.subText }]}>{tStr('splash_by_waitomo')}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    width: '100%',
    maxWidth: WEB_CONTENT_MAX_WIDTH,
    paddingHorizontal: MOBILE_SPACING.xl,
    alignItems: 'center',
  },
  logo: {
    marginBottom: MOBILE_SPACING.xs,
  },
  fitEngine: {
    fontSize: MOBILE_TYPE.display,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  byWaitomo: {
    fontSize: MOBILE_TYPE.bodyStrong,
    fontWeight: '600',
    marginTop: MOBILE_SPACING.sm,
    letterSpacing: 1,
    opacity: 0.9,
  },
});
