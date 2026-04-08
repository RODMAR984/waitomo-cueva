// screens/CreaCuentaScreen.js
// Pantalla intermedia para elegir cómo crear la cuenta:
// - Email (lleva a RegistroInicial)
// - Google (OAuth → vuelve y se resuelve acá)
// ✅ Facebook eliminado

import React, { useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { getThemeTokens } from '../theme/colors';

export default function CreaCuentaScreen() {
  const { isDark } = useThemeContext();
  const t = useMemo(() => getThemeTokens(isDark ? 'dark' : 'light', null), [isDark]);
  const { t: tStr } = useLocale();
  const navigation = useNavigation();
  const route = useRoute();

  const { signInWithProvider, user } = useAuth();

  // ⬅️ params que vienen desde AbonosPases
  const { plan, abono } = route.params || {};

  // ✅ clave: SOLO redirigir automático si el user apareció por OAuth
  const [oauthStarted, setOauthStarted] = useState(false);

  // ============================
  // ✅ FIX:
  // Antes: cualquier user.id (incluye email/password) pisaba navegación y reseteaba.
  // Ahora: solo si vos apretaste Google (oauthStarted === true).
  // ============================
  useEffect(() => {
    if (!oauthStarted) return;
    if (!user?.id) return;

    console.log('✅ CreaCuenta (OAuth): usuario autenticado:', user.id);

    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'RegistroInicial',
          params: {
            fromOAuth: true,
            plan,
            abono,
          },
        },
      ],
    });
  }, [oauthStarted, user?.id]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        kav: {
          flex: 1,
          padding: 20,
          paddingTop: 60,
        },
        outer: {
          flex: 1,
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
          marginBottom: 12,
          textAlign: 'center',
        },
        subtitle: {
          color: t.subText,
          fontSize: 14,
          marginBottom: 20,
          textAlign: 'center',
        },
        buttonPrimary: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 10,
          padding: 14,
          marginBottom: 12,
        },
        buttonPrimaryText: {
          ...t.buttonPrimaryText,
          fontWeight: 'bold',
          fontSize: 15,
        },
        buttonSocial: {
          alignItems: 'center',
          backgroundColor: t.inputBg,
          borderRadius: 10,
          padding: 12,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        buttonSocialText: {
          color: t.text,
          fontSize: 14,
          fontWeight: '600',
        },
        buttonSecondary: {
          marginTop: 12,
          alignItems: 'center',
        },
        buttonSecondaryText: {
          color: t.subText,
          fontSize: 13,
          textDecorationLine: 'underline',
        },
      }),
    [t],
  );

  // EMAIL → flujo clásico
  const handleEmail = () => {
    navigation.navigate('RegistroInicial', {
      plan,
      abono,
      fromCreaCuenta: true,
      fromOAuth: false,
    });
  };

  // GOOGLE
  const handleOAuth = async (provider) => {
    if (!signInWithProvider) {
      alert(`Login con ${provider === 'google' ? 'Google' : 'Apple'} todavía no está activo.`);
      return;
    }
    try {
      setOauthStarted(true);
      await signInWithProvider(provider);
    } catch (e) {
      console.log(`Error ${provider} OAuth:`, e);
      setOauthStarted(false);
      alert(`No se pudo iniciar con ${provider === 'google' ? 'Google' : 'Apple'}.`);
    }
  };

  const handleVolverPlanes = () => {
    navigation.navigate('PlanSelector');
  };

  return (
    <BackgroundWrapper screen="Welcome">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.outer}>
            <View style={styles.panel}>
              <Text style={styles.title}>{tStr('creacuenta_title')}</Text>
              <Text style={styles.subtitle}>{tStr('creacuenta_subtitle')}</Text>

              <TouchableOpacity
                style={styles.buttonPrimary}
                onPress={handleEmail}
              >
                <Text style={styles.buttonPrimaryText}>{tStr('creacuenta_email')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.buttonSocial}
                onPress={() => handleOAuth('google')}
              >
                <Text style={styles.buttonSocialText}>{tStr('creacuenta_continue_google')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.buttonSocial, { marginTop: 10 }]}
                onPress={() => handleOAuth('apple')}
              >
                <Text style={styles.buttonSocialText}>{tStr('creacuenta_continue_apple')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.buttonSecondary}
                onPress={handleVolverPlanes}
              >
                <Text style={styles.buttonSecondaryText}>{tStr('creacuenta_back_plans')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
