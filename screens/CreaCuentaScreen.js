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
import LogoCompleto from '../components/LogoCompleto';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { fitengineLogoColors as fe } from '../theme/colors';

export default function CreaCuentaScreen() {
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
          paddingTop: 48,
        },
        outer: {
          flex: 1,
          justifyContent: 'center',
        },
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
          marginBottom: 12,
          textAlign: 'center',
        },
        subtitle: {
          color: fe.subText,
          fontSize: 14,
          marginBottom: 20,
          textAlign: 'center',
          opacity: 0.95,
        },
        buttonPrimary: {
          alignItems: 'center',
          backgroundColor: fe.buttonBg,
          borderColor: fe.buttonBorder,
          borderRadius: 10,
          borderWidth: 1,
          padding: 14,
          marginBottom: 12,
        },
        buttonPrimaryText: {
          color: fe.buttonText,
          fontWeight: 'bold',
          fontSize: 15,
        },
        buttonSocial: {
          alignItems: 'center',
          backgroundColor: fe.inputBg,
          borderRadius: 10,
          padding: 12,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: fe.panelBorder,
        },
        buttonSocialText: {
          color: fe.text,
          fontSize: 14,
          fontWeight: '600',
        },
        buttonSecondary: {
          marginTop: 12,
          alignItems: 'center',
        },
        buttonSecondaryText: {
          color: fe.subText,
          fontSize: 13,
          textDecorationLine: 'underline',
        },
      }),
    [],
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

  const handleVolver = () => {
    if (plan || abono) {
      navigation.navigate('PlanSelector');
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('WelcomeGlobal');
  };

  return (
    <BackgroundWrapper screen="neutral">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.outer}>
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <LogoCompleto height={52} />
              <Text style={{ color: fe.subText, fontSize: 11, marginTop: 4 }}>powered by WAITOMO</Text>
            </View>
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

              <TouchableOpacity style={styles.buttonSecondary} onPress={handleVolver}>
                <Text style={styles.buttonSecondaryText}>
                  {plan || abono ? tStr('creacuenta_back_plans') : tStr('creacuenta_back_welcome')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
