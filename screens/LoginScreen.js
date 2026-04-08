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
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import BackgroundWrapper from '../components/BackgroundWrapper';
import LogoCompleto from '../components/LogoCompleto';
import PasswordInput from '../components/PasswordInput';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { fitengineLogoColors as fe } from '../theme/colors';
import { supabase } from '../supabaseClient';

const OAUTH_SIGNUP_STAFF_KEY = 'waitomo_oauth_signup_staff';

const normalizeEmail = (s) => String(s || '').trim().toLowerCase();

export default function LoginScreen() {
  const { t: tStr } = useLocale();
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
        kav: { flex: 1, padding: 20, paddingTop: 60 },
        panel: {
          backgroundColor: fe.panelBg,
          borderColor: fe.panelBorder,
          borderRadius: 16,
          borderWidth: 1,
          padding: 20,
        },
        title: {
          color: fe.subText,
          fontSize: 22,
          fontWeight: 'bold',
          marginBottom: 20,
          textAlign: 'center',
        },
        input: {
          backgroundColor: fe.inputBg,
          borderColor: fe.inputBorder,
          borderRadius: 10,
          borderWidth: 1,
          color: fe.text,
          marginBottom: 15,
          padding: 12,
        },
        button: {
          alignItems: 'center',
          backgroundColor: fe.buttonBg,
          borderColor: fe.buttonBorder,
          borderWidth: 1,
          borderRadius: 10,
          marginTop: 10,
          padding: 16,
        },
        buttonText: {
          color: fe.buttonText,
          fontWeight: 'bold',
          textAlign: 'center',
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
          borderRadius: 10,
          marginTop: 10,
          padding: 16,
        },
        socialButtonText: {
          color: fe.buttonText,
          fontWeight: 'bold',
          textAlign: 'center',
        },
      }),
    [],
  );

  /**
   * Coach/admin FitEngine: org propia = owner_id del usuario, no ser staff en Waitomo u otro gym.
   * needsFitEngineSpaceSetup engloba intent gym_owner y “sin org ajena empleado”.
   */
  const navigateByRole = useCallback(
    (effectiveRole) => {
      const finalRole = effectiveRole || contextRole || 'cliente';
      const orgId = profile?.organization_id || null;

      if (finalRole === 'superadmin') {
        navigation.reset({ index: 0, routes: [{ name: 'Admin' }] });
        return;
      }

      if (finalRole === 'coach' || finalRole === 'admin') {
        if (!authNavigationReady) {
          return;
        }
        if (needsFitEngineSpaceSetup) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'ConfiguraTuEspacio', params: { email } }],
          });
          return;
        }
        navigation.reset({ index: 0, routes: [{ name: 'AdminLite' }] });
        return;
      }

      // Entró por flujo staff/org pero aún no terminó de crear/configurar su organización
      if (forStaff && (!profile || !orgId)) {
        navigation.reset({ index: 0, routes: [{ name: 'ConfiguraTuEspacio', params: { email } }] });
        return;
      }

      if (!profile) {
        navigation.reset({ index: 0, routes: [{ name: 'RegistroInicial' }] });
        return;
      }

      navigation.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
    },
    [
      navigation,
      email,
      profile,
      contextRole,
      forStaff,
      needsFitEngineSpaceSetup,
      authNavigationReady,
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
      Alert.alert('Falta info', 'Completá email y contraseña.');
      return;
    }

    try {
      setSubmitting(true);
      const { user: loggedUser, profile: loggedProfile } = await login({
        email,
        password,
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
      navigateByRole(effectiveRole);
    } catch (error) {
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
            'Credenciales incorrectas',
            'Había una sesión con otro correo. La cerramos para que puedas iniciar con la cuenta correcta. Volvé a ingresar email y contraseña.',
          );
          return;
        }
      }

      const message =
        error?.message ||
        'No se pudo iniciar sesión. Revisá los datos o intentá de nuevo.';
      Alert.alert('Error', message);
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  };

  const handleIrAPlanes = () => {
    navigation.navigate('PlanSelector');
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert(
        'Email requerido',
        'Escribí el email con el que te registraste para enviarte el enlace.',
      );
      return;
    }

    if (!requestPasswordReset) {
      Alert.alert(
        'Próximamente',
        'La recuperación de contraseña todavía no está activada en el servidor.',
      );
      return;
    }

    try {
      setIsSendingReset(true);
      await requestPasswordReset(email.trim().toLowerCase());

      Alert.alert(
        'Revisá tu email',
        'Si existe una cuenta con ese email, te enviamos un enlace para restablecer la contraseña.',
      );
    } catch (error) {
      console.log('Error en handleForgotPassword:', error?.message);
      let mensaje = 'No se pudo enviar el email. Probá de nuevo en unos minutos.';

      if (error?.message?.includes('rate limit')) {
        mensaje =
          'Demasiados intentos seguidos. Esperá unos minutos antes de volver a probar.';
      }

      Alert.alert('Error', mensaje);
    } finally {
      if (isMountedRef.current) setIsSendingReset(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    if (!signInWithProvider) {
      Alert.alert('Error', `${provider === 'google' ? 'Google' : 'Apple'} no está disponible.`);
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
      const { data: sessData } = await supabase.auth.getSession();
      const uid = sessData?.session?.user?.id;
      if (persistActiveAppMode && uid) {
        try {
          await persistActiveAppMode(forStaff ? 'staff' : 'client', uid);
        } catch (_) {}
      }
      if (forStaff) setAllowStaffAutoNav(true);
    } catch (e) {
      if (forStaff) AsyncStorage.removeItem(OAUTH_SIGNUP_STAFF_KEY);
      console.log(`❌ [LoginScreen] ${provider} OAuth error =>`, e?.message || e);
      Alert.alert(
        'Error',
        e?.message || `No se pudo iniciar sesión con ${provider === 'google' ? 'Google' : 'Apple'}.`,
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {/* Marca plataforma: logo completo (triangulo + texto) */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <LogoCompleto height={50} />
              <Text style={{ color: fe.subText, fontSize: 12, marginTop: 4 }}>powered by WAITOMO</Text>
            </View>
            <View style={styles.panel}>
              {showStaffAccessChoice ? (
                <>
                  <Text style={styles.title}>{tStr('login_not_staff_title')}</Text>
                  <Text style={[styles.linkText, { marginTop: 0, marginBottom: 16 }]}>
                    {tStr('login_not_staff_message')}
                  </Text>
                  <TouchableOpacity
                    style={[styles.button, { marginBottom: 10 }]}
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
                    <Text
                      style={{
                        color: fe.subText,
                        fontSize: 13,
                        textAlign: 'center',
                        marginBottom: 10,
                      }}
                    >
                      {tStr('login_session_active_staff')}
                    </Text>
                    <TouchableOpacity
                      style={[styles.button, { marginBottom: 14 }]}
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
                style={[styles.socialButton, { marginTop: 10 }]}
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
                <TouchableOpacity onPress={handleIrAPlanes} disabled={disabled}>
                  <Text style={styles.linkText}>{tStr('login_no_account_plans')}</Text>
                </TouchableOpacity>
              )}
                </>
              )}
            </View>
            {/* Footer atribución (spec): discreto */}
            <View style={{ alignItems: 'center', marginTop: 16, paddingBottom: 24 }}>
              <Text style={{ color: fe.subText, fontSize: 11, opacity: 0.8 }}>FitEngine by WAITOMO</Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
