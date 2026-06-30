// CreaCuentaStaffScreen — Alta staff/coach. Misma estética que Login (neutral + FitEngine tokens).

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenShell from '../../components/ScreenShell';
import BackNavButton from '../../components/BackNavButton';
import LogoCompleto from '../../components/LogoCompleto';
import LogoTriangleBackground from '../../components/LogoTriangleBackground';
import PasswordInput from '../../components/PasswordInput';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { fitengineLogoColors as fe } from '../../theme/colors';
import { authMarketingChromeRoot, authSoftPanelStyle } from '../../theme/appVisualCohesion';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import NeoPanel from '../../components/NeoPanel';
import {
  AuthKeyboardAvoidingView,
  AuthDismissKeyboardOutside,
  authScrollKeyboardDismissMode,
  authScrollContentJustify,
} from '../../components/AuthWebFormShell';

const OAUTH_SIGNUP_STAFF_KEY = 'waitomo_oauth_signup_staff';

export default function CreaCuentaStaffScreen() {
  const { t: tStr } = useLocale();
  const { isDark } = useThemeContext();
  const navigation = useNavigation();
  const { register, signInWithProvider, session, profile, loading, needsFitEngineSpaceSetup, authNavigationReady } =
    useAuth();
  const mountedRef = useRef(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    if (!session?.user?.id || loading) return;
    if (!authNavigationReady) return;
    const role = profile?.role;
    if (role === 'coach' || role === 'admin' || role === 'superadmin') {
      if (oauthSubmitting && mountedRef.current) setOauthSubmitting(false);
      const route = needsFitEngineSpaceSetup
        ? { name: 'FitEngineSpaceIntro', params: { email: session.user.email } }
        : { name: 'AdminLite' };
      navigation.reset({ index: 0, routes: [route] });
    }
  }, [
    session?.user?.id,
    session?.user?.email,
    profile?.role,
    loading,
    navigation,
    oauthSubmitting,
    needsFitEngineSpaceSetup,
    authNavigationReady,
  ]);

  const handleOAuth = async (provider) => {
    if (!signInWithProvider) {
      const pName = tStr(provider === 'google' ? 'login_provider_google' : 'login_provider_apple');
      Alert.alert(
        tStr('gym_config_alert_title_error'),
        tStr('login_oauth_unavailable').replace('{{provider}}', pName),
      );
      return;
    }
    setOauthSubmitting(true);
    try {
      await AsyncStorage.setItem(OAUTH_SIGNUP_STAFF_KEY, '1');
      await signInWithProvider(provider);
    } catch (err) {
      await AsyncStorage.removeItem(OAUTH_SIGNUP_STAFF_KEY);
      const pName = tStr(provider === 'google' ? 'login_provider_google' : 'login_provider_apple');
      Alert.alert(
        tStr('gym_config_alert_title_error'),
        err?.message || tStr('login_oauth_signin_fail').replace('{{provider}}', pName),
      );
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
      Alert.alert(tStr('login_alert_missing_title'), tStr('login_alert_missing_body'));
      return;
    }
    if (p.length < 6) {
      Alert.alert(tStr('creacuenta_staff_alert_short_title'), tStr('creacuenta_staff_alert_short_body'));
      return;
    }
    if (p !== confirm) {
      Alert.alert(tStr('creacuenta_staff_alert_mismatch_title'), tStr('creacuenta_staff_alert_mismatch_body'));
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
        tStr('creacuenta_staff_success_title'),
        tStr('creacuenta_staff_success_body'),
        [{ text: tStr('creacuenta_staff_success_btn'), onPress: () => navigation.replace('Login', { forStaff: true }) }],
      );
    } catch (err) {
      Alert.alert(tStr('gym_config_alert_title_error'), err?.message || tStr('creacuenta_staff_error_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        kav: { flex: 1 },
        scrollContent: {
          flexGrow: 1,
          justifyContent: authScrollContentJustify(),
          padding: MOBILE_SPACING.xl,
          paddingTop: 52,
          paddingBottom: 24,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        panel: {
          ...authSoftPanelStyle,
        },
        title: {
          color: fe.text,
          fontSize: MOBILE_TYPE.title,
          fontWeight: 'bold',
          marginBottom: 8,
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
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 12,
          fontSize: MOBILE_TYPE.bodyStrong,
        },
        button: {
          alignItems: 'center',
          backgroundColor: fe.buttonBg,
          borderColor: fe.buttonBorder,
          borderWidth: 1,
          borderRadius: MOBILE_RADII.md,
          padding: MOBILE_SPACING.lg,
          marginTop: 8,
        },
        buttonText: { color: fe.buttonText, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: 'bold', textAlign: 'center' },
        link: {
          marginTop: 20,
          alignSelf: 'center',
        },
        linkText: { color: fe.subText, fontSize: MOBILE_TYPE.body, textDecorationLine: 'underline' },
        separatorText: {
          color: fe.subText,
          marginTop: MOBILE_SPACING.lg,
          marginBottom: 8,
          textAlign: 'center',
          fontSize: MOBILE_TYPE.caption,
        },
        socialButton: {
          alignItems: 'center',
          backgroundColor: fe.buttonBg,
          borderColor: fe.buttonBorder,
          borderWidth: 1,
          borderRadius: MOBILE_RADII.md,
          padding: MOBILE_SPACING.lg,
          marginTop: 10,
        },
        socialButtonText: { color: fe.buttonText, fontWeight: 'bold', textAlign: 'center' },
      }),
    [],
  );

  const disabled = submitting || oauthSubmitting;

  const formInner = (
            <View>
              <View style={{ width: '100%', alignItems: 'center', marginBottom: 14 }}>
                <LogoCompleto height={52} />
              </View>

              <NeoPanel edge={false} style={styles.panel}>
                <Text style={styles.title}>{tStr('creacuenta_staff_title')}</Text>
                <Text style={styles.subtitle}>{tStr('creacuenta_staff_subtitle')}</Text>

                <TextInput
                  placeholder={tStr('creacuenta_staff_ph_name')}
                  placeholderTextColor={fe.placeholder}
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
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
                  placeholder={tStr('creacuenta_staff_ph_password_help')}
                  placeholderTextColor={fe.placeholder}
                  style={styles.input}
                  containerStyle={{ marginBottom: 12 }}
                  value={password}
                  onChangeText={setPassword}
                />
                <PasswordInput
                  placeholder={tStr('creacuenta_staff_ph_confirm')}
                  placeholderTextColor={fe.placeholder}
                  style={styles.input}
                  containerStyle={{ marginBottom: 12 }}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />

                <TouchableOpacity style={styles.button} onPress={handleCrear} disabled={disabled}>
                  <Text style={styles.buttonText}>
                    {submitting ? tStr('creacuenta_staff_creating') : tStr('creacuenta_staff_btn_create')}
                  </Text>
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
                <BackNavButton onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
              </NeoPanel>

              <View style={{ width: '100%', alignItems: 'center', marginTop: 22 }}>
                <Text style={{ color: fe.subText, fontSize: MOBILE_TYPE.meta, opacity: 0.75 }}>{tStr('gym_config_footer')}</Text>
              </View>
            </View>
  );

  return (
    <ScreenShell screen="neutral">
      <View style={authMarketingChromeRoot}>
        <LogoTriangleBackground
          isDark={isDark}
          variant="registro"
          blendMode="lighten"
          sizeScale={2.8}
          opacityOverride={isDark ? 0.42 : 0.28}
        />
        <AuthKeyboardAvoidingView style={[styles.kav, { flex: 1, zIndex: 1 }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={authScrollKeyboardDismissMode}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <AuthDismissKeyboardOutside>{formInner}</AuthDismissKeyboardOutside>
          </ScrollView>
        </AuthKeyboardAvoidingView>
      </View>
    </ScreenShell>
  );
}
