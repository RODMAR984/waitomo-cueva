// screens/RegistroInicialScreen.js
// — Registro profesional: crea usuario real en Supabase (Auth + profiles)
// — Si el usuario YA tiene cuenta, puede ir a Login y seguir el flujo con el plan/abono elegido
// — Si viene de OAuth (Google/Facebook/Apple), NO vuelve a crear auth: completa datos mínimos y sigue a Pago

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import BackgroundWrapper from '../components/BackgroundWrapper';
import LogoCompleto from '../components/LogoCompleto';
import PasswordInput from '../components/PasswordInput';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { fitengineLogoColors as fe } from '../theme/colors';

export default function RegistroInicialScreen({ route, navigation }) {
  // Recibimos plan y abono desde Abonos/PlanDetail o desde CreaCuenta (OAuth)
  const { plan, abono, fromOAuth } = route?.params || {};

  /** Sin plan = alta desde FitEngine global (Welcome → Crear cuenta), no marketing Waitomo en fondo. */
  const hasPlanContext = !!(plan && (plan.id || plan.title || plan.name || plan.nombre));

  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  // ⬇️ OJO: en OAuth NO usamos register(), usamos user actual
  // Intento de compatibilidad: si en tu AuthContext existe alguna función de upsert/ensure profile, la usamos.
  const {
    register,
    user,
    profile,
    upsertProfile,
    ensureProfile,
    updateProfile,
  } = useAuth();

  // ✅ OAuth real: por flag o por provider != email
  const provider = user?.app_metadata?.provider || null;
  const isOAuth = !!fromOAuth || (!!provider && provider !== 'email');

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // -------------------------
  // Prefill cuando viene de OAuth
  // -------------------------
  useEffect(() => {
    if (!isOAuth) return;

    const meta = user?.user_metadata || {};
    const oauthEmail = user?.email || meta?.email || '';
    const oauthName =
      meta?.full_name || meta?.name || meta?.nombre || meta?.display_name || '';

    if (!email && oauthEmail) setEmail(oauthEmail);
    if (!nombre && oauthName) setNombre(oauthName);
  }, [isOAuth, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (submitting) return;

    // Validaciones por modo
    if (!nombre || !email || !telefono) {
      Alert.alert(tStr('reg_ini_alert_faltan_title'), tStr('reg_ini_alert_faltan_body'));
      return;
    }

    if (!isOAuth) {
      if (!password || !confirmPassword) {
        Alert.alert(tStr('reg_ini_alert_faltan_title'), tStr('reg_ini_alert_faltan_body'));
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert(tStr('reg_ini_alert_pass_title'), tStr('reg_ini_alert_pass_body'));
        return;
      }
    }

    const planActual = (plan && (plan.id || plan.name || plan.title)) || null;

    try {
      setSubmitting(true);

      console.log('🟣 RegistroInicial: click Continuar a pago');
      console.log('isOAuth:', isOAuth, '| fromOAuth:', !!fromOAuth, '| provider:', provider);
      console.log('user?.id:', user?.id || null);
      console.log('route params:', route?.params);

      // =========================================================
      // ✅ MODO A: Registro por Email/Password (crea auth + profile)
      // =========================================================
      if (!isOAuth) {
        const createdUser = await register({
          email,
          password,
          fullName: nombre,
          phone: telefono,
          planActual,
          username: null,
        });

        if (!createdUser || !createdUser.id) {
          console.log('❌ Registro inicial: user sin id', createdUser);
          Alert.alert(tStr('reg_ini_error_create_title'), tStr('reg_ini_error_create_body'));
          return;
        }

        const userData = {
          id: createdUser.id,
          nombre,
          telefono,
          email,
          password,
          ...(abono?.precio != null ? { precio: abono.precio } : {}),
        };

        console.log('✅ RegistroInicial (EMAIL) -> navigate Pago', {
          plan,
          userData,
          abono,
        });

        navigation.navigate('Pago', { plan, userData, abono });
        return;
      }

      // =========================================================
      // ✅ MODO B: OAuth (NO crear auth de nuevo)
      // =========================================================
      if (!user?.id) {
        Alert.alert(tStr('reg_ini_error_auth_title'), tStr('reg_ini_error_auth_body'));
        return;
      }

      // ✅ Payload con columnas REALES (no invento)
      const profilePayload = {
        id: user.id,
        full_name: nombre || null,
        phone: telefono || null,
        username: null,
        role: profile?.role || 'cliente',
        plan_actual: planActual || null,
      };

      // 🔥 FIX CLAVE:
      // - NO usamos Promise.race ni timeouts fake
      // - NO frenamos el flujo a Pago
      // - Disparamos guardado del profile "fire-and-forget"
      try {
        const fn =
          (typeof ensureProfile === 'function' && ensureProfile) ||
          (typeof upsertProfile === 'function' && upsertProfile) ||
          (typeof updateProfile === 'function' && updateProfile) ||
          null;

        if (fn) {
          console.log('🧩 RegistroInicial OAuth: disparando guardado profile (NO bloquea flujo)...');
          Promise.resolve(fn(profilePayload))
            .then(() => console.log('✅ RegistroInicial OAuth: profile guardado/actualizado'))
            .catch((e) =>
              console.log(
                '🟠 RegistroInicial OAuth: profile NO bloquea flujo. Error =>',
                e?.message || e,
              ),
            );
        } else {
          console.log(
            '🟠 RegistroInicial OAuth: no hay ensureProfile/upsertProfile/updateProfile en AuthContext. Sigo igual.',
          );
        }
      } catch (e) {
        console.log('🟠 RegistroInicial OAuth: profile NO bloquea flujo. Error =>', e?.message || e);
      }

      const userData = {
        id: user.id,
        nombre,
        telefono,
        email,
        ...(abono?.precio != null ? { precio: abono.precio } : {}),
      };

      console.log('✅ RegistroInicial (OAUTH) -> navigate Pago', {
        plan,
        userData,
        abono,
      });

      // ✅ SIEMPRE navega a Pago aunque el profile falle/tarde
      navigation.navigate('Pago', { plan, userData, abono });
    } catch (error) {
      console.log('❌ Error en registro inicial:', error);
      const message = error?.message || tStr('reg_ini_error_generic');
      Alert.alert(tStr('gym_config_alert_title_error'), message);
    } finally {
      setSubmitting(false);
    }
  };

  const styles = useMemo(() => {
    const shellFe = !hasPlanContext;
    const bg = shellFe ? fe.panelBg : t.boxBg;
    const border = shellFe ? fe.panelBorder : t.overlayBorder;
    const inputBg = shellFe ? fe.inputBg : t.inputBg;
    const textCol = shellFe ? fe.text : t.text;
    const subCol = shellFe ? fe.subText : t.subText;
    return StyleSheet.create({
      button: {
        alignItems: 'center',
        ...(shellFe
          ? {
              backgroundColor: fe.buttonBg,
              borderColor: fe.buttonBorder,
              borderWidth: 1,
            }
          : t.buttonPrimary),
        borderRadius: 10,
        marginBottom: 20,
        marginTop: 10,
        padding: 16,
        opacity: submitting ? 0.7 : 1,
      },
      buttonText: {
        ...(shellFe ? { color: fe.buttonText } : t.buttonPrimaryText),
        fontWeight: 'bold',
        textAlign: 'center',
      },
      input: {
        backgroundColor: inputBg,
        borderColor: border,
        borderRadius: 10,
        borderWidth: 1,
        color: textCol,
        marginBottom: 15,
        padding: 12,
      },
      kav: { flex: 1 },
      panel: {
        backgroundColor: bg,
        borderColor: border,
        borderRadius: 16,
        borderWidth: 1,
        padding: 20,
      },
      scroll: {
        backgroundColor: 'transparent',
        flexGrow: 1,
        padding: 20,
        paddingTop: hasPlanContext ? 60 : 24,
      },
      title: {
        color: subCol,
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
      },
      subtitle: {
        color: subCol,
        fontSize: 14,
        textAlign: 'center',
        opacity: 0.9,
      },
      loginLinkText: {
        color: subCol,
        fontSize: 13,
        textAlign: 'center',
        textDecorationLine: 'underline',
      },
      inlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      },
      spinner: { marginLeft: 10 },
    });
  }, [t, submitting, hasPlanContext]);

  const handleYaTengoCuenta = () => {
    navigation.navigate('Login', {
      plan,
      abono,
      fromRegistro: true,
    });
  };

  const placeholderColor = hasPlanContext ? t.placeholder : fe.placeholder;

  return (
    <BackgroundWrapper screen={hasPlanContext ? undefined : 'neutral'} plan={plan}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {!hasPlanContext ? (
              <View style={{ width: '100%', alignItems: 'center', marginBottom: 16 }}>
                <LogoCompleto height={48} />
                <Text style={{ color: fe.subText, fontSize: 11, marginTop: 4 }}>{tStr('login_brand_powered')}</Text>
              </View>
            ) : null}
            <View style={styles.panel}>
              <Text style={styles.title}>
                {isOAuth ? tStr('registro_title_oauth') : tStr('registro_title')}
              </Text>
              {isOAuth && (
                <Text style={[styles.subtitle, { marginBottom: 16 }]}>
                  {tStr('registro_subtitle_oauth')}
                </Text>
              )}

              <TextInput
                style={styles.input}
                placeholder={tStr('registro_placeholder_name')}
                placeholderTextColor={placeholderColor}
                value={nombre}
                onChangeText={setNombre}
              />

              <TextInput
                style={styles.input}
                placeholder={tStr('registro_placeholder_phone')}
                placeholderTextColor={placeholderColor}
                value={telefono}
                onChangeText={setTelefono}
                keyboardType="phone-pad"
              />

              <TextInput
                style={styles.input}
                placeholder={tStr('registro_placeholder_email')}
                placeholderTextColor={placeholderColor}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isOAuth}
              />

              {!isOAuth && (
                <>
                  <PasswordInput
                    style={styles.input}
                    placeholder={tStr('registro_placeholder_password')}
                    placeholderTextColor={placeholderColor}
                    value={password}
                    onChangeText={setPassword}
                    containerStyle={{ marginBottom: 15 }}
                  />

                  <PasswordInput
                    style={styles.input}
                    placeholder={tStr('registro_placeholder_confirm_password')}
                    placeholderTextColor={placeholderColor}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    containerStyle={{ marginBottom: 15 }}
                  />
                </>
              )}

              <TouchableOpacity
                style={styles.button}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <View style={styles.inlineRow}>
                  <Text style={styles.buttonText}>
                    {submitting ? tStr('registro_continuing') : tStr('registro_continue_pago')}
                  </Text>
                  {submitting ? (
                    <ActivityIndicator size="small" style={styles.spinner} />
                  ) : null}
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleYaTengoCuenta} disabled={submitting}>
                <Text style={styles.loginLinkText}>
                  {tStr('registro_has_account')}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
