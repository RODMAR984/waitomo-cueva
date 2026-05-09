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
import BackNavButton from '../components/BackNavButton';
import LogoCompleto from '../components/LogoCompleto';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { fitengineLogoColors as fe } from '../theme/colors';
import { WEB_CONTENT_MAX_WIDTH } from '../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';
import NeoPanel from '../components/NeoPanel';

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
          padding: MOBILE_SPACING.xl,
          paddingTop: 48,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        outer: {
          flex: 1,
          justifyContent: 'center',
        },
        panel: {
          backgroundColor: fe.panelBg,
          borderColor: fe.panelBorder,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          padding: MOBILE_SPACING.xl,
        },
        title: {
          color: fe.subText,
          fontSize: MOBILE_TYPE.title,
          fontWeight: 'bold',
          marginBottom: MOBILE_SPACING.md,
          textAlign: 'center',
        },
        subtitle: {
          color: fe.subText,
          fontSize: MOBILE_TYPE.body,
          marginBottom: MOBILE_SPACING.xl,
          textAlign: 'center',
          opacity: 0.95,
        },
        buttonPrimary: {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: fe.buttonBg,
          borderColor: fe.buttonBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          paddingVertical: MOBILE_SPACING.md,
          paddingHorizontal: MOBILE_SPACING.lg,
          minHeight: MOBILE_SIZES.controlHeightLg,
          marginBottom: MOBILE_SPACING.md,
        },
        buttonPrimaryText: {
          color: fe.buttonText,
          fontWeight: 'bold',
          fontSize: MOBILE_TYPE.bodyStrong,
        },
        buttonSocial: {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: fe.inputBg,
          borderRadius: MOBILE_RADII.sm,
          paddingVertical: MOBILE_SPACING.md,
          paddingHorizontal: MOBILE_SPACING.md,
          minHeight: MOBILE_SIZES.controlHeight,
          marginBottom: MOBILE_SPACING.sm + 2,
          borderWidth: 1,
          borderColor: fe.panelBorder,
        },
        buttonSocialText: {
          color: fe.text,
          fontSize: MOBILE_TYPE.body,
          fontWeight: '600',
        },
        buttonSecondary: {
          marginTop: MOBILE_SPACING.md,
          alignItems: 'center',
        },
        buttonSecondaryText: {
          color: fe.subText,
          fontSize: MOBILE_TYPE.caption,
          textDecorationLine: 'underline',
        },
        brandPowered: { color: fe.subText, fontSize: MOBILE_TYPE.caption, marginTop: MOBILE_SPACING.xs },
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
            <View style={{ width: '100%', alignItems: 'center', marginBottom: MOBILE_SPACING.md + 2 }}>
              <LogoCompleto height={52} />
              <Text style={styles.brandPowered}>powered by WAITOMO</Text>
            </View>
            <NeoPanel style={styles.panel}>
              <BackNavButton onPress={handleVolver} />
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
                style={[styles.buttonSocial, { marginTop: MOBILE_SPACING.sm + 2 }]}
                onPress={() => handleOAuth('apple')}
              >
                <Text style={styles.buttonSocialText}>{tStr('creacuenta_continue_apple')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.buttonSecondary} onPress={handleVolver}>
                <Text style={styles.buttonSecondaryText}>
                  {plan || abono ? tStr('creacuenta_back_plans') : tStr('creacuenta_back_welcome')}
                </Text>
              </TouchableOpacity>
            </NeoPanel>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
