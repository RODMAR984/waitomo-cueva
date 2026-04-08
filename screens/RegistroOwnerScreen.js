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
import PasswordInput from '../components/PasswordInput';
import LogoTriangleBackground from '../components/LogoTriangleBackground';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { fitengineLogoColors as fe } from '../theme/colors';
import { supabase } from '../supabaseClient';

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
          paddingHorizontal: 24,
          paddingVertical: 32,
          paddingTop: 32 + insets.top,
          paddingBottom: 32 + insets.bottom,
        },
        title: {
          color: fe.text,
          fontSize: 20,
          fontWeight: '700',
          marginBottom: 6,
          textAlign: 'center',
        },
        subtitle: {
          color: fe.subText,
          fontSize: 13,
          marginBottom: 20,
          textAlign: 'center',
        },
        input: {
          backgroundColor: fe.inputBg,
          borderColor: fe.inputBorder,
          borderRadius: 10,
          borderWidth: 1,
          color: fe.text,
          marginBottom: 12,
          padding: 12,
          fontSize: 15,
        },
        btn: {
          backgroundColor: fe.primary,
          borderWidth: 0,
          borderRadius: 10,
          paddingVertical: 14,
          alignItems: 'center',
          marginTop: 16,
        },
        btnText: {
          color: fe.text,
          fontWeight: '600',
          fontSize: 15,
        },
        linkWrap: { marginTop: 16, alignItems: 'center' },
        linkText: {
          color: fe.subText,
          fontSize: 13,
          textDecorationLine: 'underline',
        },
      }),
    [t, insets.top, insets.bottom],
  );

  const handleRegistro = async () => {
    const e = (email || '').trim().toLowerCase();
    const p = password || '';
    const n = (nombre || '').trim();
    if (!e || !p || !n) {
      Alert.alert(tStr('registro_owner_falta') || 'Faltan datos', tStr('registro_owner_completa') || 'Completá email, contraseña y nombre.');
      return;
    }
    if (p.length < 6) {
      Alert.alert(tStr('registro_owner_pass_corta') || 'Contraseña corta', 'Mínimo 6 caracteres.');
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
      if (!authData?.user) throw new Error('No se creó el usuario.');
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
        Alert.alert(
          'Email ya registrado',
          'Este email ya existe. Ingresá con tu cuenta.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Ir a login',
              onPress: () => navigation.navigate('Login', { forStaff: true, prefillEmail: e }),
            },
          ],
        );
      } else {
        Alert.alert('Error', err?.message || 'No se pudo crear la cuenta.');
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
            <Text style={styles.title}>{tStr('registro_owner_titulo') || 'Crear cuenta (gym / coach)'}</Text>
            <Text style={styles.subtitle}>
              {tStr('registro_owner_subtitle') || 'Después configurás tu espacio (nombre, tipo, logo).'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder={tStr('login_email') || 'Email'}
              placeholderTextColor={fe.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <PasswordInput
              placeholder={tStr('login_password') || 'Contraseña'}
              placeholderTextColor={fe.placeholder}
              style={styles.input}
              containerStyle={{ marginBottom: 10 }}
              value={password}
              onChangeText={setPassword}
            />
            <TextInput
              style={styles.input}
              placeholder={tStr('perfil_nombre') || 'Nombre completo'}
              placeholderTextColor={fe.placeholder}
              value={nombre}
              onChangeText={setNombre}
            />

            <TouchableOpacity style={styles.btn} onPress={handleRegistro} disabled={loading}>
              <Text style={styles.btnText}>
                {loading ? (tStr('login_entering') || '...') : (tStr('registro_owner_siguiente') || 'Siguiente')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkWrap} onPress={() => navigation.navigate('WelcomeGlobal')}>
              <Text style={styles.linkText}>{tStr('welcome_soy_cliente') || 'Soy cliente'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
