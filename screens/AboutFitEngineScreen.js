// Pantalla "Acerca de": versión, marca, enlaces legales (navegador) y contacto opcional.

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';

import BackgroundWrapper from '../components/BackgroundWrapper';
import BackNavButton from '../components/BackNavButton';
import LogoCompleto from '../components/LogoCompleto';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { getFitEngineUrls } from '../utils/fitengineUrls';
import { WEB_CONTENT_MAX_WIDTH } from '../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';

export default function AboutFitEngineScreen() {
  const navigation = useNavigation();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { profile } = useAuth();

  const version = Constants.expoConfig?.version || '—';
  const { supportEmail, supportPhone } = useMemo(() => getFitEngineUrls(), []);

  const phoneDial = useMemo(() => String(supportPhone || '').replace(/[^\d+]/g, ''), [supportPhone]);

  const openMail = useCallback(async () => {
    const e = String(supportEmail || '').trim();
    if (!e) return;
    const mailto = `mailto:${e}`;
    try {
      await Linking.openURL(mailto);
    } catch (_) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('about_open_fail'));
    }
  }, [supportEmail, tStr]);

  const openPhone = useCallback(async () => {
    if (!phoneDial) return;
    const tel = `tel:${phoneDial}`;
    try {
      await Linking.openURL(tel);
    } catch (_) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('about_open_fail'));
    }
  }, [phoneDial, tStr]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexGrow: 1,
          paddingHorizontal: MOBILE_SPACING.xl,
          paddingTop: 80,
          paddingBottom: MOBILE_SPACING.xxl + MOBILE_SPACING.lg,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        panel: {
          borderRadius: MOBILE_RADII.lg,
          padding: MOBILE_SPACING.xl - 2,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        logoWrap: { width: '100%', alignItems: 'center', marginBottom: MOBILE_SPACING.lg },
        title: { fontSize: MOBILE_TYPE.title, fontWeight: '700', color: t.text, marginBottom: MOBILE_SPACING.sm, textAlign: 'center' },
        tagline: { fontSize: MOBILE_TYPE.body, color: t.subText, textAlign: 'center', marginBottom: MOBILE_SPACING.xl, lineHeight: 20 },
        versionRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: MOBILE_SPACING.sm,
          marginBottom: MOBILE_SPACING.xl,
          paddingVertical: MOBILE_SPACING.sm + 2,
          borderRadius: MOBILE_RADII.md,
          backgroundColor: t.segmentInactiveBg ?? t.faintStrong,
        },
        versionLabel: { fontSize: MOBILE_TYPE.caption, color: t.subText },
        versionValue: { fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '700', color: t.text },
        hint: { fontSize: MOBILE_TYPE.caption, color: t.subText, textAlign: 'center', marginBottom: MOBILE_SPACING.lg, lineHeight: 18 },
        supportFootnote: {
          fontSize: 11,
          color: t.subText,
          textAlign: 'center',
          lineHeight: 16,
          marginTop: -4,
          marginBottom: MOBILE_SPACING.md,
          paddingHorizontal: MOBILE_SPACING.sm,
        },
        linkBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: MOBILE_SIZES.controlHeight,
          paddingVertical: MOBILE_SPACING.md + 2,
          paddingHorizontal: MOBILE_SPACING.md + 2,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          marginBottom: MOBILE_SPACING.sm + 2,
        },
        linkLabel: { fontSize: MOBILE_TYPE.bodyStrong, color: t.text, flex: 1 },
        backButton: {
          marginTop: MOBILE_SPACING.lg,
          alignSelf: 'center',
          minHeight: MOBILE_SIZES.controlHeight,
          paddingVertical: MOBILE_SPACING.sm + 2,
          paddingHorizontal: MOBILE_SPACING.xl,
          borderRadius: MOBILE_RADII.pill,
          flexDirection: 'row',
          alignItems: 'center',
          gap: MOBILE_SPACING.sm,
          ...t.buttonPrimary,
        },
        backButtonText: { ...t.buttonPrimaryText, fontSize: MOBILE_TYPE.body },
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
            <>
              <TouchableOpacity style={styles.linkBtn} onPress={openMail} activeOpacity={0.85}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkLabel}>{tStr('about_support')}</Text>
                  <Text style={[styles.hint, { textAlign: 'left', marginBottom: 0, marginTop: 4 }]}>
                    {supportEmail}
                  </Text>
                </View>
                <Ionicons name="mail-outline" size={22} color={t.subText} />
              </TouchableOpacity>
              <Text style={styles.supportFootnote}>{tStr('about_support_note')}</Text>
            </>
          )}

          {!!String(supportPhone || '').trim() && (
            <>
              <TouchableOpacity style={styles.linkBtn} onPress={openPhone} activeOpacity={0.85}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkLabel}>{tStr('about_phone_support')}</Text>
                  <Text style={[styles.hint, { textAlign: 'left', marginBottom: 0, marginTop: 4 }]}>
                    {supportPhone}
                  </Text>
                </View>
                <Ionicons name="call-outline" size={22} color={t.subText} />
              </TouchableOpacity>
              <Text style={styles.supportFootnote}>{tStr('about_phone_note')}</Text>
            </>
          )}

          <BackNavButton onPress={() => navigation.goBack()} label={tStr('config_back')} style={styles.backButton} />
        </View>
      </ScrollView>
    </BackgroundWrapper>
  );
}
