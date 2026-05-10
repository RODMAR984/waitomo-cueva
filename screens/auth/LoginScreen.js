// screens/LoginScreen.js
// ✅ Login real: email+password + Google OAuth robusto (NO se cuelga)
// ✅ Facebook eliminado (muerto)
// ✅ Navega automáticamente cuando AuthContext levanta session/profile

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import LogoCompleto from '../../components/LogoCompleto';
import PasswordInput from '../../components/PasswordInput';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import { fitengineLogoColors as fe } from '../../theme/colors';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import { WEB_CONTENT_MAX_WIDTH, WEB_PANEL_RADIUS } from '../../theme/webSpec';
import { supabase } from '../../supabaseClient';
import { resolvePostAuthDestination } from '../../utils/authRoutingGuard';
import { reportError, trackEvent } from '../../utils/observability';
import NeoPanel from '../../components/NeoPanel';

const OAUTH_SIGNUP_STAFF_KEY = 'waitomo_oauth_signup_staff';

const normalizeEmail = (s) => String(s || '').trim().toLowerCase();

export default function LoginScreen() {
  const { t: tStr } = useLocale();
  const { width: winW } = useWindowDimensions();
  const navigation = useNavigation();
  const route = useRoute();
  const { fromRegistro, forStaff, prefillEmail } = route?.params || {};

  const {
    login,
    requestPasswordReset,
    signInWithProvider,
    logout,
    role: contextRole,
    loading,
    profile,
    session,
    persistActiveAppMode,
    initialProfileSyncDone,
    needsFitEngineSpaceSetup,
    authNavigationReady,
    hasClientMembership,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  // Cuando entraste por staff pero la cuenta es cliente: mostrar opción clara en vez de mandar al panel cliente
  const [showStaffAccessChoice, setShowStaffAccessChoice] = useState(false);
  // Staff: no saltar a AdminLite solo porque la sesión restauró el perfil (Welcome → Login forStaff).
  // Solo navegar cuando el usuario eligió OAuth, "Continuar al panel" o handleLogin (contraseña).
  const [allowStaffAutoNav, setAllowStaffAutoNav] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) setAllowStaffAutoNav(false);
  }, [session?.user?.id]);

  useEffect(() => {
    if (prefillEmail) setEmail(String(prefillEmail).trim());
  }, [prefillEmail]);

  // Cuando cambia el usuario de la sesión (login nuevo / restaurado), alinear el campo email con esa sesión.
  // No tocar si viene prefillEmail por ruta. Así sessionMatchesInputEmail puede ser true y el flujo normal sigue.
  const lastSessionUserIdRef = useRef(null);
  useEffect(() => {
    if (prefillEmail) return;
    const uid = session?.user?.id;
    if (!uid) {
      lastSessionUserIdRef.current = null;
      return;
    }
    if (lastSessionUserIdRef.current === uid) return;
    lastSessionUserIdRef.current = uid;
    const s = session?.user?.email;
    if (s) setEmail(s);
  }, [session?.user?.id, session?.user?.email, prefillEmail]);

  // Si el usuario escribe otro correo que el de la sesión activa, NO auto-navegar al panel de esa sesión
  // (evita: login falla con "Invalid credentials" pero seguís con token viejo y te manda a ClientTabs del usuario anterior).
  const sessionMatchesInputEmail = useMemo(() => {
    if (!session?.user?.id) return true;
    const s = normalizeEmail(session.user?.email);
    const e = normalizeEmail(email);
    if (!e) return false;
    return s === e;
  }, [session?.user?.id, session?.user?.email, email]);

  // evita setState después de navegar (unmounted)
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Gate para evitar navegar ANTES de que termine el fetch de profile
  const [postAuthGateOpen, setPostAuthGateOpen] = useState(false);
  useEffect(() => {
    setPostAuthGateOpen(false);
    if (session?.user?.id) {
      const tm = setTimeout(() => setPostAuthGateOpen(true), 1200);
      return () => clearTimeout(tm);
    }
  }, [session?.user?.id]);

  // Si la sesión ya llegó, quitamos el spinner de OAuth
  useEffect(() => {
    if (session?.user?.id && oauthSubmitting) {
      if (isMountedRef.current) setOauthSubmitting(false);
    }
  }, [session?.user?.id, oauthSubmitting]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        kav: { flex: 1 },
        scrollContent: {
          flexGrow: 1,
          justifyContent: 'center',
          padding: MOBILE_SPACING.xl,
          paddingTop: 60,
          paddingBottom: MOBILE_SPACING.sm,
          alignItems: 'center',
        },
        pageColumn: {
          width: '100%',
          maxWidth: Platform.OS === 'web' ? Math.min(WEB_CONTENT_MAX_WIDTH, 440) : 520,
          alignSelf: 'center',
        },
        panel: {
          backgroundColor: fe.panelBg,
          borderColor: fe.panelBorder,
          borderRadius: WEB_PANEL_RADIUS,
          borderWidth: 1,
          padding: MOBILE_SPACING.xl,
          width: '100%',
        },
        title: {
          color: fe.subText,
          fontSize: MOBILE_TYPE.title,
          fontWeight: 'bold',
          marginBottom: MOBILE_SPACING.xl,
          textAlign: 'center',
        },
        input: {
          backgroundColor: fe.inputBg,
          borderColor: fe.inputBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          color: fe.text,
          marginBottom: 15,
          minHeight: MOBILE_SIZES.controlHeight,
          paddingHorizontal: MOBILE_SPACING.md,
          paddingVertical: MOBILE_SPACING.md,
        },
        button: {
          alignItems: 'center',
          backgroundColor: fe.buttonBg,
          borderColor: fe.buttonBorder,
          borderWidth: 1,
          borderRadius: MOBILE_RADII.sm,
          minHeight: MOBILE_SIZES.controlHeightLg,
          marginTop: 10,
          paddingVertical: MOBILE_SPACING.md,
          paddingHorizontal: MOBILE_SPACING.lg,
          justifyContent: 'center',
        },
        buttonText: {
          color: fe.buttonText,
          fontWeight: 'bold',
          textAlign: 'center',
          fontSize: MOBILE_TYPE.bodyStrong,
        },
        linkText: {
          color: fe.subText,
          marginTop: 16,
          textAlign: 'center',
          textDecorationLine: 'underline',
          fontSize: 13,
        },
        smallLink: {
          color: fe.subText,
          marginTop: 10,
          textAlign: 'center',
          fontSize: 12,
          textDecorationLine: 'underline',
        },
        separatorText: {
          color: fe.subText,
          marginTop: 20,
          marginBottom: 6,
          textAlign: 'center',
          fontSize: 12,
        },
        socialButton: {
          alignItems: 'center',
          backgroundColor: fe.buttonBg,
          borderColor: fe.buttonBorder,
          borderWidth: 1,
          borderRadius: MOBILE_RADII.sm,
          minHeight: MOBILE_SIZES.controlHeightLg,
          marginTop: 10,
          paddingVertical: MOBILE_SPACING.md,
          paddingHorizontal: MOBILE_SPACING.lg,
          justifyContent: 'center',
        },
        socialButtonText: {
          color: fe.buttonText,
          fontWeight: 'bold',
          textAlign: 'center',
          fontSize: MOBILE_TYPE.bodyStrong,
        },
        brandTop: { width: '100%', alignItems: 'center', marginBottom: 12 },
        brandPowered: { color: fe.subText, fontSize: MOBILE_TYPE.caption, marginTop: 4 },
        notStaffText: { marginTop: 0, marginBottom: 16 },
        buttonSpaced: { marginBottom: 10 },
        staffSessionHint: {
          color: fe.subText,
          fontSize: 13,
          textAlign: 'center',
          marginBottom: 10,
        },
        buttonStaffContinue: { marginBottom: 14 },
        socialButtonStack: { marginTop: 10 },
        linkRowSpaced: { marginTop: 10 },
        brandBottom: { width: '100%', alignItems: 'center', marginTop: 24, paddingBottom: 16 },
        brandFooter: { color: fe.subText, fontSize: 11, opacity: 0.8 },
      }),
    [winW],
  );

  /**
   * Coach/admin FitEngine: org propia = owner_id del usuario, no ser staff en Waitomo u otro gym.
   * needsFitEngineSpaceSetup engloba intent gym_owner y “sin org ajena empleado”.
   */
  const navigateByRole = useCallback(
    (effectiveRole, profileOverride) => {
      const p = profileOverride !== undefined ? profileOverride : profile;
      const destination = resolvePostAuthDestination({
        role: effectiveRole || contextRole,
        profile: p,
        forStaff,
        needsFitEngineSpaceSetup,
        authNavigationReady,
        hasClientMembership: !!hasClientMembership,
      });
      if (!destination) return;

      const params =
        destination === 'ConfiguraTuEspacio'
          ? { email }
          : undefined;

      navigation.reset({ index: 0, routes: [{ name: destination, params }] });
    },
    [
      navigation,
      email,
      profile,
      contextRole,
      forStaff,
      needsFitEngineSpaceSetup,
      authNavigationReady,
      hasClientMembership,
    ],
  );

  const isStaffRole = (r) => r === 'superadmin' || r === 'coach' || r === 'admin';

  // OAuth / sesión sin fila en profiles → RegistroInicial. NO disparar mientras el sync post-login
  // aún trae profile=null (carrera: iba a RegistroInicial antes de que llegue el perfil existente).
  useEffect(() => {
    if (!session?.user?.id || profile != null || loading || submitting) return;
    if (forStaff) return;
    if (initialProfileSyncDone === false) return;
    if (!authNavigationReady) return;
    navigation.reset({
      index: 0,
      routes: [{ name: 'RegistroInicial', params: { fromOAuth: true } }],
    });
  }, [
    session?.user?.id,
    profile,
    loading,
    submitting,
    forStaff,
    navigation,
    initialProfileSyncDone,
    authNavigationReady,
  ]);

  // Auto-navegación cuando session/profile ya están (email o google con perfil completo)
  // Si entraste por STAFF: solo mandar a Admin/AdminLite si el rol es staff; si es cliente, mostrar opción (no mandar al panel cliente sin avisar)
  useEffect(() => {
    if (!session?.user?.id) return;
    if (!sessionMatchesInputEmail) return;
    if (loading || submitting) return;
    if (!(profile || postAuthGateOpen)) return;

    if (forStaff) {
      if (isStaffRole(contextRole)) {
        setShowStaffAccessChoice(false);
        if (!allowStaffAutoNav) return;
        navigateByRole(contextRole);
        return;
      }
      // Entraste por staff pero esta cuenta es cliente → no auto-redirigir; mostrar elección
      setShowStaffAccessChoice(true);
      return;
    }

    setShowStaffAccessChoice(false);
    navigateByRole(contextRole);
  }, [
    session?.user?.id,
    sessionMatchesInputEmail,
    loading,
    submitting,
    profile,
    contextRole,
    postAuthGateOpen,
    forStaff,
    navigateByRole,
    authNavigationReady,
    needsFitEngineSpaceSetup,
    allowStaffAutoNav,
  ]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(tStr('login_alert_missing_title'), tStr('login_alert_missing_body'));
      return;
    }

    try {
      setSubmitting(true);
      const { user: loggedUser, profile: loggedProfile } = await login({
        email,
        password,
      });
      trackEvent('auth_login_success', {
        forStaff: !!forStaff,
        role: loggedProfile?.role || null,
        userId: loggedUser?.id || null,
      });

      // Intención cliente vs staff (misma cuenta; se persiste por user id de Supabase, no por nombre de org)
      if (persistActiveAppMode && loggedUser?.id) {
        try {
          await persistActiveAppMode(forStaff ? 'staff' : 'client', loggedUser.id);
        } catch (_) {}
      }

      const effectiveRole = loggedProfile?.role || 'cliente';
      if (forStaff && !isStaffRole(effectiveRole)) {
        setShowStaffAccessChoice(true);
        return;
      }
      navigateByRole(effectiveRole, loggedProfile);
    } catch (error) {
      reportError('auth_login_failed', error, {
        forStaff: !!forStaff,
      });
      console.log('Error login Supabase:', error);
      const msg = String(error?.message || '');
      const invalidCreds =
        error?.code === 'invalid_credentials' ||
        msg.includes('Invalid login credentials') ||
        msg.toLowerCase().includes('invalid login');

      // Otra sesión activa + intentás entrar con otro mail y falla → cerrar sesión vieja para no ver el panel equivocado
      if (invalidCreds && session?.user?.email) {
        const attempted = normalizeEmail(email);
        const current = normalizeEmail(session.user.email);
        if (attempted && attempted !== current) {
          try {
            if (logout) await logout();
          } catch (_) {}
          Alert.alert(
            tStr('login_alert_wrong_creds_other_session_title'),
            tStr('login_alert_wrong_creds_other_session_body'),
          );
          return;
        }
      }

      const message = error?.message || tStr('login_error_signin_generic');
      Alert.alert(tStr('gym_config_alert_title_error'), message);
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert(tStr('login_alert_email_required_title'), tStr('login_alert_email_required_body'));
      return;
    }

    if (!requestPasswordReset) {
      Alert.alert(tStr('login_alert_reset_soon_title'), tStr('login_alert_reset_soon_body'));
      return;
    }

    try {
      setIsSendingReset(true);
      await requestPasswordReset(email.trim().toLowerCase());

      Alert.alert(tStr('login_alert_reset_check_email_title'), tStr('login_alert_reset_check_email_body'));
    } catch (error) {
      console.log('Error en handleForgotPassword:', error?.message);
      let mensaje = tStr('login_error_reset_send');

      if (error?.message?.includes('rate limit')) {
        mensaje = tStr('login_error_reset_rate_limit');
      }

      Alert.alert(tStr('gym_config_alert_title_error'), mensaje);
    } finally {
      if (isMountedRef.current) setIsSendingReset(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    if (!signInWithProvider) {
      const pName = tStr(provider === 'google' ? 'login_provider_google' : 'login_provider_apple');
      Alert.alert(
        tStr('gym_config_alert_title_error'),
        tStr('login_oauth_unavailable').replace('{{provider}}', pName),
      );
      return;
    }
    setOauthSubmitting(true);
    if (forStaff) {
      await AsyncStorage.setItem(OAUTH_SIGNUP_STAFF_KEY, '1');
    }
    const safetyTimer = setTimeout(() => {
      if (isMountedRef.current) setOauthSubmitting(false);
    }, 12000);
    try {
      await signInWithProvider(provider);
      trackEvent('auth_oauth_success', {
        provider,
        forStaff: !!forStaff,
      });
      const { data: sessData } = await supabase.auth.getSession();
      const uid = sessData?.session?.user?.id;
      if (persistActiveAppMode && uid) {
        try {
          await persistActiveAppMode(forStaff ? 'staff' : 'client', uid);
        } catch (_) {}
      }
      if (forStaff) setAllowStaffAutoNav(true);
    } catch (e) {
      reportError('auth_oauth_failed', e, {
        provider,
        forStaff: !!forStaff,
      });
      if (forStaff) AsyncStorage.removeItem(OAUTH_SIGNUP_STAFF_KEY);
      console.log(`❌ [LoginScreen] ${provider} OAuth error =>`, e?.message || e);
      const pName = tStr(provider === 'google' ? 'login_provider_google' : 'login_provider_apple');
      Alert.alert(
        tStr('gym_config_alert_title_error'),
        e?.message || tStr('login_oauth_signin_fail').replace('{{provider}}', pName),
      );
    } finally {
      clearTimeout(safetyTimer);
      if (isMountedRef.current) setOauthSubmitting(false);
    }
  };

  const handleCrearCuentaStaffDesdeCliente = async () => {
    setShowStaffAccessChoice(false);
    try {
      if (logout) await logout();
    } catch (_) {}
    navigation.navigate('CreaCuentaStaff');
  };

  const handleEntrarComoCliente = () => {
    setShowStaffAccessChoice(false);
    navigateByRole('cliente');
  };

  const disabled = submitting || oauthSubmitting;
  const disabledReset = isSendingReset || disabled;

  return (
    <BackgroundWrapper screen="neutral">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageColumn}>
            <View style={styles.brandTop}>
              <LogoCompleto height={50} />
              <Text style={styles.brandPowered}>{tStr('login_brand_powered')}</Text>
            </View>
            <NeoPanel style={styles.panel}>
              <BackNavButton onPress={() => navigation.goBack()} />
              {showStaffAccessChoice ? (
                <>
                  <Text style={styles.title}>{tStr('login_not_staff_title')}</Text>
                  <Text style={[styles.linkText, styles.notStaffText]}>
                    {tStr('login_not_staff_message')}
                  </Text>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonSpaced]}
                    onPress={handleCrearCuentaStaffDesdeCliente}
                  >
                    <Text style={styles.buttonText}>{tStr('login_create_staff_account')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.socialButton}
                    onPress={handleEntrarComoCliente}
                  >
                    <Text style={styles.socialButtonText}>{tStr('login_enter_as_client')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
              <Text style={styles.title}>
                {forStaff ? tStr('login_title_staff') : tStr('login_title')}
              </Text>

              {forStaff &&
                session?.user?.id &&
                isStaffRole(contextRole) &&
                !allowStaffAutoNav &&
                (profile || postAuthGateOpen) && (
                  <>
                    <Text style={styles.staffSessionHint}>
                      {tStr('login_session_active_staff')}
                    </Text>
                    <TouchableOpacity
                      style={[styles.button, styles.buttonStaffContinue]}
                      onPress={() => setAllowStaffAutoNav(true)}
                      disabled={disabled}
                    >
                      <Text style={styles.buttonText}>
                        {tStr('login_continue_staff_panel')}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

              <TextInput
                placeholder={tStr('login_email')}
                placeholderTextColor={fe.placeholder}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <PasswordInput
                placeholder={tStr('login_password')}
                placeholderTextColor={fe.placeholder}
                style={styles.input}
                containerStyle={{ marginBottom: 15 }}
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity
                style={styles.button}
                onPress={handleLogin}
                disabled={disabled}
              >
                <Text style={styles.buttonText}>
                  {submitting ? tStr('login_entering') : tStr('login_enter')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleForgotPassword} disabled={disabledReset}>
                <Text style={styles.smallLink}>
                  {isSendingReset ? tStr('login_sending_link') : tStr('login_forgot_password')}
                </Text>
              </TouchableOpacity>

              <Text style={styles.separatorText}>{tStr('login_or_continue')}</Text>

              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleOAuthLogin('google')}
                disabled={disabled}
              >
                <Text style={styles.socialButtonText}>
                  {oauthSubmitting ? tStr('login_entering') : tStr('login_continue_google')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialButton, styles.socialButtonStack]}
                onPress={() => handleOAuthLogin('apple')}
                disabled={disabled}
              >
                <Text style={styles.socialButtonText}>
                  {oauthSubmitting ? tStr('login_entering') : tStr('login_continue_apple')}
                </Text>
              </TouchableOpacity>

              {!fromRegistro && forStaff && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('CreaCuentaStaff')}
                  disabled={disabled}
                >
                  <Text style={styles.linkText}>{tStr('login_no_account_staff')}</Text>
                </TouchableOpacity>
              )}
              {!fromRegistro && !forStaff && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('JoinWithInvite')}
                  disabled={disabled}
                  style={styles.linkRowSpaced}
                >
                  <Text style={styles.linkText}>{tStr('welcome_join_with_code')}</Text>
                </TouchableOpacity>
              )}
                </>
              )}
            </NeoPanel>
            <View style={styles.brandBottom}>
              <LogoCompleto height={30} style={{ marginBottom: 6 }} />
              <Text style={styles.brandFooter}>{tStr('gym_config_footer')}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
