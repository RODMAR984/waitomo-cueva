// CreaCuentaStaffScreen — Alta de staff (coach/admin). Fondo tipo Welcome.
// Email + contraseña o Continuar con Google → perfil con role 'coach'. Redirige a AdminLite.

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundWrapper from '../components/BackgroundWrapper';
import PasswordInput from '../components/PasswordInput';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';

const OAUTH_SIGNUP_STAFF_KEY = 'waitomo_oauth_signup_staff';

export default function CreaCuentaStaffScreen() {
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const navigation = useNavigation();
  const { register, signInWithProvider, session, profile, loading } = useAuth();
  const mountedRef = useRef(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Después de volver de OAuth con cuenta staff (role coach), ir al panel
  useEffect(() => {
    if (!mountedRef.current) return;
    if (!session?.user?.id || loading) return;
    const role = profile?.role;
    if (role === 'coach' || role === 'admin' || role === 'superadmin') {
      if (oauthSubmitting && mountedRef.current) setOauthSubmitting(false);
      navigation.reset({ index: 0, routes: [{ name: 'AdminLite' }] });
    }
  }, [session?.user?.id, profile?.role, loading, navigation]);

  const handleOAuth = async (provider) => {
    if (!signInWithProvider) {
      Alert.alert('Error', `${provider === 'google' ? 'Google' : 'Apple'} no está disponible.`);
      return;
    }
    setOauthSubmitting(true);
    try {
      await AsyncStorage.setItem(OAUTH_SIGNUP_STAFF_KEY, '1');
      await signInWithProvider(provider);
    } catch (err) {
      await AsyncStorage.removeItem(OAUTH_SIGNUP_STAFF_KEY);
      Alert.alert('Error', err?.message || `No se pudo continuar con ${provider === 'google' ? 'Google' : 'Apple'}.`);
    } finally {
      if (mountedRef.current) setOauthSubmitting(false);
    }
  };

  const handleCrear = async () => {
    const e = (email || '').trim().toLowerCase();
    const p = (password || '').trim();
    const confirm = (confirmPassword || '').trim();
    const n = (fullName || '').trim();
    if (!e || !p) {
      Alert.alert('Falta info', 'Completá email y contraseña.');
      return;
    }
    if (p.length < 6) {
      Alert.alert('Contraseña corta', 'Usá al menos 6 caracteres.');
      return;
    }
    if (p !== confirm) {
      Alert.alert('Las contraseñas no coinciden', 'Revisá contraseña y confirmar contraseña.');
      return;
    }
    try {
      setSubmitting(true);
      await register({
        email: e,
        password: p,
        fullName: n || null,
        role: 'coach',
      });
      Alert.alert(
        'Cuenta creada',
        'Ya podés iniciar sesión con tu email y contraseña. Un admin puede asignarte el plan que coordinás.',
        [{ text: 'Ir a ingresar', onPress: () => navigation.replace('Login', { forStaff: true }) }]
      );
    } catch (err) {
      Alert.alert('Error', err?.message || 'No se pudo crear la cuenta.');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          padding: 24,
          paddingTop: 56,
          justifyContent: 'center',
        },
        panel: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 16,
          borderWidth: 1,
          padding: 20,
        },
        title: {
          color: t.text,
          fontSize: 22,
          fontWeight: 'bold',
          marginBottom: 8,
          textAlign: 'center',
        },
        subtitle: {
          color: t.subText,
          fontSize: 14,
          marginBottom: 20,
          textAlign: 'center',
        },
        input: {
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          color: t.text,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 12,
          fontSize: 16,
        },
        button: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 10,
          padding: 16,
          marginTop: 8,
        },
        buttonText: { ...t.buttonPrimaryText, fontSize: 16 },
        link: {
          marginTop: 20,
          alignSelf: 'center',
        },
        linkText: { color: t.subText, fontSize: 14, textDecorationLine: 'underline' },
        separatorText: {
          color: t.subText,
          marginTop: 16,
          marginBottom: 8,
          textAlign: 'center',
          fontSize: 12,
        },
        socialButton: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 10,
          padding: 16,
          marginTop: 10,
        },
        socialButtonText: { ...t.buttonPrimaryText, fontWeight: 'bold', textAlign: 'center' },
      }),
    [t]
  );

  const disabled = submitting || oauthSubmitting;

  return (
    <BackgroundWrapper screen="Welcome">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.screen}>
            <View style={styles.panel}>
              <Text style={styles.title}>{tStr('creacuenta_staff_title')}</Text>
              <Text style={styles.subtitle}>{tStr('creacuenta_staff_subtitle')}</Text>

              <TextInput
                placeholder="Nombre completo"
              placeholderTextColor={t.placeholder}
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
                autoCapitalize="words"
              />
              <TextInput
              placeholder="Email"
              placeholderTextColor={t.placeholder}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <PasswordInput
                placeholder="Contraseña (mín. 6 caracteres)"
                placeholderTextColor={t.placeholder}
                style={styles.input}
                containerStyle={{ marginBottom: 12 }}
                value={password}
                onChangeText={setPassword}
              />
              <PasswordInput
                placeholder="Confirmar contraseña"
                placeholderTextColor={t.placeholder}
                style={styles.input}
                containerStyle={{ marginBottom: 12 }}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />

              <TouchableOpacity style={styles.button} onPress={handleCrear} disabled={disabled}>
                <Text style={styles.buttonText}>{submitting ? 'Creando...' : 'Crear cuenta con email'}</Text>
              </TouchableOpacity>

              <Text style={styles.separatorText}>{tStr('creacuenta_staff_or')}</Text>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => handleOAuth('google')}
                disabled={disabled}
              >
                <Text style={styles.socialButtonText}>
                  {oauthSubmitting ? tStr('login_entering') : tStr('login_continue_google')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.socialButton, { marginTop: 10 }]}
                onPress={() => handleOAuth('apple')}
                disabled={disabled}
              >
                <Text style={styles.socialButtonText}>
                  {oauthSubmitting ? tStr('login_entering') : tStr('login_continue_apple')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.link}
                onPress={() => navigation.navigate('Login', { forStaff: true })}
              >
                <Text style={styles.linkText}>{tStr('creacuenta_staff_has_account')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
