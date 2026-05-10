// RegistroOwnerScreen — Crear cuenta gym/coach. Fondo t.bg + triángulo más notorio y algo más grande. SIN logo completo. Campos/botones/texto un poco más chicos.
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PasswordInput from '../../components/PasswordInput';
import LogoTriangleBackground from '../../components/LogoTriangleBackground';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { fitengineLogoColors as fe } from '../../theme/colors';
import { supabase } from '../../supabaseClient';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';

/** Ancho máximo del formulario gym/coach (no usar WEB_CONTENT_MAX_WIDTH de dashboard). */
const REGISTRO_OWNER_FORM_MAX_WIDTH = 400;

export default function RegistroOwnerScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t, isDark } = useThemeContext();
  const { t: tStr } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Fondo a borde completo (sin insets) para que no se vean líneas de transición
        container: { flex: 1, backgroundColor: t.bg, overflow: 'hidden' },
        kav: { flex: 1 },
        centerWrap: {
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingVertical: 32,
          paddingTop: 32 + insets.top,
          paddingBottom: 32 + insets.bottom,
          width: '100%',
          maxWidth: REGISTRO_OWNER_FORM_MAX_WIDTH,
          alignSelf: 'center',
        },
        title: {
          color: fe.text,
          fontSize: MOBILE_TYPE.title,
          fontWeight: '700',
          marginBottom: 6,
          textAlign: 'center',
        },
        subtitle: {
          color: fe.subText,
          fontSize: MOBILE_TYPE.body,
          marginBottom: 20,
          textAlign: 'center',
        },
        input: {
          backgroundColor: fe.inputBg,
          borderColor: fe.inputBorder,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          color: fe.text,
          marginBottom: 12,
          padding: 12,
          fontSize: MOBILE_TYPE.bodyStrong,
        },
        btn: {
          backgroundColor: fe.primary,
          borderWidth: 0,
          borderRadius: MOBILE_RADII.md,
          paddingVertical: 14,
          alignItems: 'center',
          marginTop: MOBILE_SPACING.lg,
        },
        btnText: {
          color: fe.text,
          fontWeight: '600',
          fontSize: MOBILE_TYPE.bodyStrong,
        },
        backFooter: {
          alignSelf: 'center',
          marginTop: MOBILE_SPACING.xl,
          minHeight: 44,
          maxWidth: 200,
          width: '100%',
          paddingVertical: MOBILE_SPACING.sm,
          paddingHorizontal: MOBILE_SPACING.md,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          borderColor: fe.inputBorder,
          backgroundColor: 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        },
        backFooterText: {
          color: fe.text,
          fontSize: MOBILE_TYPE.body,
          fontWeight: '700',
          marginLeft: 6,
        },
      }),
    [t, insets.top, insets.bottom],
  );

  const handleRegistro = async () => {
    const e = (email || '').trim().toLowerCase();
    const p = password || '';
    const n = (nombre || '').trim();
    if (!e || !p || !n) {
      Alert.alert(tStr('registro_owner_falta'), tStr('registro_owner_completa'));
      return;
    }
    if (p.length < 6) {
      Alert.alert(tStr('registro_owner_pass_corta'), tStr('registro_owner_pass_min_body'));
      return;
    }
    setLoading(true);
    try {
      // role + signup_intent en user_metadata: el trigger handle_new_user() crea profiles.role
      // (coach|admin|superadmin); si no, queda 'cliente'. Debe quedar fijado en el alta, no solo al guardar espacio.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: e,
        password: p,
        options: {
          data: {
            full_name: n,
            role: 'coach',
            signup_intent: 'gym_owner',
          },
        },
      });
      if (authError) throw authError;
      if (!authData?.user) throw new Error(tStr('registro_owner_error_no_user'));
      navigation.replace('ConfiguraTuEspacio', { email: e, fullName: n });
    } catch (err) {
      const msg = String(err?.message || '');
      const alreadyExists =
        msg.toLowerCase().includes('already') ||
        msg.toLowerCase().includes('registered') ||
        msg.toLowerCase().includes('exists') ||
        msg.toLowerCase().includes('ya') ||
        msg.toLowerCase().includes('registrad');

      if (alreadyExists) {
        Alert.alert(tStr('registro_owner_email_taken_title'), tStr('registro_owner_email_taken_body'), [
          { text: tStr('common_cancel'), style: 'cancel' },
          {
            text: tStr('registro_owner_go_login'),
            onPress: () => navigation.navigate('Login', { forStaff: true, prefillEmail: e }),
          },
        ]);
      } else {
        Alert.alert(tStr('gym_config_alert_title_error'), err?.message || tStr('registro_owner_error_generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Fondo (triángulo + partículas) como background real */}
      <LogoTriangleBackground
        isDark={isDark}
        variant="registro"
        blendMode="lighten"
        sizeScale={2.8}
        opacityOverride={isDark ? 0.42 : 0.28}
      />
      <KeyboardAvoidingView
        style={[styles.kav, { zIndex: 1 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.centerWrap}>
            <Text style={styles.title}>{tStr('registro_owner_titulo')}</Text>
            <Text style={styles.subtitle}>{tStr('registro_owner_subtitle')}</Text>

            <TextInput
              style={styles.input}
              placeholder={tStr('login_email')}
              placeholderTextColor={fe.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <PasswordInput
              placeholder={tStr('login_password')}
              placeholderTextColor={fe.placeholder}
              style={styles.input}
              containerStyle={{ marginBottom: 10 }}
              value={password}
              onChangeText={setPassword}
            />
            <TextInput
              style={styles.input}
              placeholder={tStr('perfil_nombre')}
              placeholderTextColor={fe.placeholder}
              value={nombre}
              onChangeText={setNombre}
            />

            <TouchableOpacity style={styles.btn} onPress={handleRegistro} disabled={loading}>
              <Text style={styles.btnText}>
                {loading ? tStr('login_entering') : tStr('registro_owner_siguiente')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backFooter}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-back" size={18} color={fe.text} />
              <Text style={styles.backFooterText}>{tStr('common_back')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
