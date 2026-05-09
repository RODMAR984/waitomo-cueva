// Unirse a un gym con código — shell FitEngine (misma línea que Login / Crear cuenta).

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackgroundWrapper from '../components/BackgroundWrapper';
import BackNavButton from '../components/BackNavButton';
import LogoCompleto from '../components/LogoCompleto';
import LogoTriangleBackground from '../components/LogoTriangleBackground';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { fitengineLogoColors as fe } from '../theme/colors';
import {
  setPendingClientInviteCode,
  getPendingClientInviteCode,
} from '../utils/pendingClientInviteStorage';
import { supabase } from '../supabaseClient';
import { getClientPostAuthRouteName } from '../utils/clientPostAuthRoute';
import { WEB_CONTENT_MAX_WIDTH } from '../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';

export default function JoinWithInviteCodeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t: tStr } = useLocale();
  const { session, joinOrganizationWithInviteCode } = useAuth() || {};

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pending = await getPendingClientInviteCode();
      if (cancelled || !pending) return;
      setCode((prev) => (String(prev || '').trim() ? prev : String(pending).toUpperCase()));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        kav: {
          flex: 1,
          paddingHorizontal: MOBILE_SPACING.xl,
          paddingTop: Math.max(insets.top, MOBILE_SPACING.md) + MOBILE_SPACING.sm,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        outer: { flex: 1, justifyContent: 'center' },
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
          fontWeight: '800',
          marginBottom: MOBILE_SPACING.sm,
          textAlign: 'center',
        },
        hint: {
          color: fe.subText,
          fontSize: MOBILE_TYPE.body,
          lineHeight: 20,
          marginBottom: MOBILE_SPACING.xl - 2,
          textAlign: 'center',
          opacity: 0.95,
        },
        input: {
          borderWidth: 1,
          borderColor: fe.panelBorder,
          borderRadius: MOBILE_RADII.sm,
          paddingHorizontal: MOBILE_SPACING.md,
          paddingVertical: MOBILE_SPACING.md,
          color: fe.text,
          backgroundColor: fe.inputBg,
          fontSize: MOBILE_TYPE.title - 4,
          fontWeight: '700',
          letterSpacing: 1,
          marginBottom: MOBILE_SPACING.lg,
          minHeight: MOBILE_SIZES.controlHeight,
        },
        primary: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: MOBILE_SPACING.md,
          paddingHorizontal: MOBILE_SPACING.lg,
          minHeight: MOBILE_SIZES.controlHeightLg,
          borderRadius: MOBILE_RADII.sm,
          backgroundColor: fe.buttonBg,
          borderWidth: 1,
          borderColor: fe.buttonBorder,
        },
        primaryText: { color: fe.buttonText, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800' },
        link: { marginTop: MOBILE_SPACING.xl - 2, alignItems: 'center' },
        linkText: { color: fe.subText, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '600', textDecorationLine: 'underline' },
        brandPowered: { color: fe.subText, fontSize: MOBILE_TYPE.caption, marginTop: MOBILE_SPACING.xs },
      }),
    [insets.top]
  );

  const mapError = (res) => {
    const e = res?.error;
    if (e === 'invalid_code') return tStr('invite_error_invalid');
    if (e === 'role_not_client') return tStr('invite_error_not_client');
    if (e === 'not_authenticated') return tStr('invite_error_auth');
    if (e === 'empty_code') return tStr('invite_error_empty');
    return res?.message || tStr('invite_error_generic');
  };

  const goPostJoin = async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    const { data: p } = await supabase
      .from('profiles')
      .select('plan_actual')
      .eq('id', uid)
      .maybeSingle();
    const route = getClientPostAuthRouteName(p || {});
    navigation.reset({ index: 0, routes: [{ name: route }] });
  };

  const onSubmit = async () => {
    const c = String(code || '').trim();
    if (!c) {
      Alert.alert(tStr('invite_title'), tStr('invite_error_empty'));
      return;
    }
    if (!session?.user?.id) {
      await setPendingClientInviteCode(c);
      Alert.alert(tStr('invite_pending_title'), tStr('invite_pending_body'), [
        {
          text: tStr('invite_go_login'),
          onPress: () => navigation.navigate('Login', { forStaff: false }),
        },
      ]);
      return;
    }
    setBusy(true);
    try {
      const res = await joinOrganizationWithInviteCode(c);
      if (!res?.ok) {
        Alert.alert(tStr('invite_title'), mapError(res));
        return;
      }
      await goPostJoin();
    } finally {
      setBusy(false);
    }
  };

  return (
    <BackgroundWrapper screen="neutral">
      <View style={{ flex: 1 }}>
        <LogoTriangleBackground
          isDark
          sizeScale={2.4}
          opacityOverride={0.2}
          blendMode="screen"
        />
        <KeyboardAvoidingView
          style={{ flex: 1, zIndex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.kav}>
            <View style={{ width: '100%', alignItems: 'center', marginBottom: MOBILE_SPACING.md + 2 }}>
              <LogoCompleto height={52} />
              <Text style={styles.brandPowered}>powered by WAITOMO</Text>
            </View>
            <View style={styles.outer}>
              <View style={styles.panel}>
                <BackNavButton onPress={() => navigation.goBack()} />
                <Text style={styles.title}>{tStr('invite_title')}</Text>
                <Text style={styles.hint}>{tStr('invite_hint')}</Text>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={(s) => setCode(s.toUpperCase())}
                  placeholder={tStr('invite_placeholder')}
                  placeholderTextColor={fe.placeholder}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={16}
                  editable={!busy}
                />
                <TouchableOpacity
                  style={[styles.primary, busy && { opacity: 0.65 }]}
                  onPress={onSubmit}
                  disabled={busy}
                  activeOpacity={0.9}
                >
                  {busy ? (
                    <ActivityIndicator color={fe.buttonText} />
                  ) : (
                    <Text style={styles.primaryText}>{tStr('invite_cta')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.link} onPress={() => navigation.goBack()} activeOpacity={0.85}>
                  <Text style={styles.linkText}>{tStr('invite_back')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </View>
    </BackgroundWrapper>
  );
}
