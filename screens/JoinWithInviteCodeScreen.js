// Unirse a un gym con código — shell FitEngine (misma línea que Login / Crear cuenta).

import React, { useMemo, useState } from 'react';
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
import LogoCompleto from '../components/LogoCompleto';
import LogoTriangleBackground from '../components/LogoTriangleBackground';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { fitengineLogoColors as fe } from '../theme/colors';
import { setPendingClientInviteCode } from '../utils/pendingClientInviteStorage';
import { supabase } from '../supabaseClient';
import { getClientPostAuthRouteName } from '../utils/clientPostAuthRoute';

export default function JoinWithInviteCodeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t: tStr } = useLocale();
  const { session, joinOrganizationWithInviteCode } = useAuth() || {};

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        kav: { flex: 1, paddingHorizontal: 20, paddingTop: Math.max(insets.top, 12) + 8 },
        outer: { flex: 1, justifyContent: 'center' },
        panel: {
          backgroundColor: fe.panelBg,
          borderColor: fe.panelBorder,
          borderRadius: 16,
          borderWidth: 1,
          padding: 20,
        },
        title: { color: fe.subText, fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
        hint: { color: fe.subText, fontSize: 14, lineHeight: 20, marginBottom: 18, textAlign: 'center', opacity: 0.95 },
        input: {
          borderWidth: 1,
          borderColor: fe.panelBorder,
          borderRadius: 12,
          padding: 14,
          color: fe.text,
          backgroundColor: fe.inputBg,
          fontSize: 18,
          fontWeight: '700',
          letterSpacing: 1,
          marginBottom: 16,
        },
        primary: {
          alignItems: 'center',
          paddingVertical: 16,
          borderRadius: 12,
          backgroundColor: fe.buttonBg,
          borderWidth: 1,
          borderColor: fe.buttonBorder,
        },
        primaryText: { color: fe.buttonText, fontSize: 16, fontWeight: '800' },
        link: { marginTop: 18, alignItems: 'center' },
        linkText: { color: fe.subText, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
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
            <View style={{ width: '100%', alignItems: 'center', marginBottom: 14 }}>
              <LogoCompleto height={52} />
              <Text style={{ color: fe.subText, fontSize: 11, marginTop: 4 }}>powered by WAITOMO</Text>
            </View>
            <View style={styles.outer}>
              <View style={styles.panel}>
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
