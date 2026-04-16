// AdminLoginScreen — Acceso exclusivo del administrador (superadmin).
// Solo email + contraseña. Si la cuenta no es superadmin, no entra; no se mezcla con staff ni cliente.

import React, { useMemo, useState, useRef, useEffect } from 'react';
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
import BackgroundWrapper from '../components/BackgroundWrapper';
import PasswordInput from '../components/PasswordInput';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { getThemeTokens } from '../theme/colors';

export default function AdminLoginScreen() {
  const { isDark } = useThemeContext();
  const { t: tStr } = useLocale();
  const t = useMemo(() => getThemeTokens(isDark ? 'dark' : 'light', null), [isDark]);
  const navigation = useNavigation();
  const { login, logout, profile, session, loading } = useAuth();
  const mountedRef = useRef(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Cuando ya hay sesión y perfil cargado: si es superadmin → Admin; si no → aviso y logout
  useEffect(() => {
    if (!mountedRef.current || !session?.user?.id || loading) return;
    if (profile?.id !== session.user.id) return;
    if (profile?.role === 'superadmin') {
      navigation.reset({ index: 0, routes: [{ name: 'Admin' }] });
      return;
    }
    if (profile?.role != null) {
      logout().catch(() => {});
      Alert.alert(tStr('admin_login_no_access_title'), tStr('admin_login_no_access_body'));
    }
  }, [session?.user?.id, profile?.id, profile?.role, loading, navigation, logout]);

  const handleEntrar = async () => {
    const e = (email || '').trim().toLowerCase();
    const p = (password || '').trim();
    if (!e || !p) {
      Alert.alert(tStr('admin_login_missing_title'), tStr('admin_login_missing_body'));
      return;
    }
    try {
      setSubmitting(true);
      await login({ email: e, password: p });
    } catch (err) {
      if (mountedRef.current) {
        const msg = err?.message || '';
        const isInvalidCreds = /invalid|credencial|credentials|incorrect|wrong/i.test(msg);
        Alert.alert(
          tStr('gym_config_alert_title_error'),
          isInvalidCreds ? tStr('admin_login_error_invalid') : msg || tStr('admin_login_error_generic'),
        );
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
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
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 6,
          textAlign: 'center',
        },
        subtitle: {
          color: t.subText,
          fontSize: 13,
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
        backLink: { marginTop: 20, alignSelf: 'center' },
        backLinkText: { color: t.subText, fontSize: 13, textDecorationLine: 'underline' },
      }),
    [t]
  );

  return (
    <BackgroundWrapper screen="Welcome">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.screen}>
            <View style={styles.panel}>
              <Text style={styles.title}>{tStr('admin_login_title')}</Text>
              <Text style={styles.subtitle}>{tStr('admin_login_subtitle')}</Text>

              <TextInput
                placeholder={tStr('login_email')}
                placeholderTextColor={t.placeholder}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <PasswordInput
                placeholder={tStr('login_password')}
                placeholderTextColor={t.placeholder}
                style={styles.input}
                containerStyle={{ marginBottom: 12 }}
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity
                style={styles.button}
                onPress={handleEntrar}
                disabled={submitting}
              >
                <Text style={styles.buttonText}>
                  {submitting ? tStr('admin_login_verifying') : tStr('admin_login_enter')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backLink}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backLinkText}>{tStr('common_back')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
