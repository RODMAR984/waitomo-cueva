// Pantalla "Acerca de": versión, marca, enlaces legales (navegador) y contacto opcional.

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';

import BackgroundWrapper from '../components/BackgroundWrapper';
import LogoCompleto from '../components/LogoCompleto';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { getFitEngineUrls } from '../utils/fitengineUrls';

export default function AboutFitEngineScreen() {
  const navigation = useNavigation();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { profile } = useAuth();

  const version = Constants.expoConfig?.version || '—';
  const { supportEmail } = useMemo(() => getFitEngineUrls(), []);

  const openMail = useCallback(async () => {
    const e = String(supportEmail || '').trim();
    if (!e) return;
    const mailto = `mailto:${encodeURIComponent(e)}`;
    try {
      await Linking.openURL(mailto);
    } catch (_) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('about_open_fail'));
    }
  }, [supportEmail, tStr]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 80, paddingBottom: 40 },
        panel: {
          borderRadius: 20,
          padding: 18,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        logoWrap: { alignItems: 'center', marginBottom: 16 },
        title: { fontSize: 22, fontWeight: '700', color: t.text, marginBottom: 6, textAlign: 'center' },
        tagline: { fontSize: 14, color: t.subText, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
        versionRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: t.segmentInactiveBg ?? t.faintStrong,
        },
        versionLabel: { fontSize: 13, color: t.subText },
        versionValue: { fontSize: 15, fontWeight: '700', color: t.text },
        hint: { fontSize: 12, color: t.subText, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
        linkBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          marginBottom: 10,
        },
        linkLabel: { fontSize: 15, color: t.text, flex: 1 },
        backButton: {
          marginTop: 16,
          alignSelf: 'center',
          paddingVertical: 10,
          paddingHorizontal: 20,
          borderRadius: 999,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          ...t.buttonPrimary,
        },
        backButtonText: { ...t.buttonPrimaryText, fontSize: 14 },
      }),
    [t],
  );

  return (
    <BackgroundWrapper plan={{ id: profile?.plan_actual }} screen="config">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.panel}>
          <View style={styles.logoWrap}>
            <LogoCompleto height={44} />
          </View>
          <Text style={styles.title}>{tStr('about_title')}</Text>
          <Text style={styles.tagline}>{tStr('about_tagline')}</Text>

          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>{tStr('about_version_label')}</Text>
            <Text style={styles.versionValue}>{version}</Text>
          </View>

          <Text style={styles.hint}>{tStr('about_legal_hint')}</Text>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => navigation.navigate('PrivacyPolicy')}
            activeOpacity={0.85}
          >
            <Text style={styles.linkLabel}>{tStr('about_privacy')}</Text>
            <Ionicons name="chevron-forward-outline" size={20} color={t.subText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => navigation.navigate('TermsOfUse')}
            activeOpacity={0.85}
          >
            <Text style={styles.linkLabel}>{tStr('about_terms')}</Text>
            <Ionicons name="chevron-forward-outline" size={20} color={t.subText} />
          </TouchableOpacity>

          {!!String(supportEmail || '').trim() && (
            <TouchableOpacity style={styles.linkBtn} onPress={openMail} activeOpacity={0.85}>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkLabel}>{tStr('about_support')}</Text>
                <Text style={[styles.hint, { textAlign: 'left', marginBottom: 0, marginTop: 4 }]}>
                  {supportEmail}
                </Text>
              </View>
              <Ionicons name="mail-outline" size={22} color={t.subText} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.9}>
            <Ionicons name="arrow-back" size={18} color={t.primaryText} />
            <Text style={styles.backButtonText}>{tStr('config_back')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </BackgroundWrapper>
  );
}
