// Bienvenida al espacio (tenant): branding de la org configurado en GymConfig (logo, fondo, tema).
// Tras el Welcome Global de FitEngine: primera pantalla “de tu gym” antes del selector de planes o el panel.

import React, { useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { resolveOrgLogoUri } from '../utils/resolveOrgLogoUri';

export default function WelcomeOrganizationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { organization, profile } = useAuth() || {};

  const clientTabsParams = route.params?.clientTabsParams;

  const [orgWaitTimedOut, setOrgWaitTimedOut] = useState(false);
  useEffect(() => {
    if (organization?.id || !profile?.id) return undefined;
    const id = setTimeout(() => setOrgWaitTimedOut(true), 6000);
    return () => clearTimeout(id);
  }, [organization?.id, profile?.id]);

  const logoUri = useMemo(() => resolveOrgLogoUri(organization?.logo_url), [organization?.logo_url]);

  const orgName = organization?.name?.trim() || tStr('welcome_org_fallback_name');

  const hasPlan =
    !!(profile?.plan_actual && String(profile.plan_actual).trim());

  const onPrimary = () => {
    if (hasPlan) {
      navigation.replace('ClientTabs', clientTabsParams);
      return;
    }
    navigation.replace('PlanSelector');
  };

  const onSkipToPanel = () => {
    navigation.replace('ClientTabs', clientTabsParams);
  };

  if (!organization?.id) {
    const showFallback = orgWaitTimedOut || (profile?.id && !profile?.organization_id);
    return (
      <BackgroundWrapper screen="neutral">
        <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
          {!showFallback ? (
            <>
              <ActivityIndicator size="large" color={t.brand} />
              <Text style={[styles.muted, { color: t.subText, marginTop: 16 }]}>
                {tStr('common_loading')}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.subtitle, { color: t.text, marginBottom: 20 }]}>
                {tStr('welcome_org_no_org_hint')}
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, t.buttonPrimary]}
                onPress={() => navigation.replace('ClientTabs', clientTabsParams)}
                activeOpacity={0.9}
              >
                <Text style={[styles.primaryBtnText, t.buttonPrimaryText]}>{tStr('welcome_org_cta_panel')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper screen="OrgWelcome">
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={[styles.logoPlaceholder, { borderColor: t.overlayBorder, backgroundColor: t.boxBg }]}>
              <Text style={[styles.logoPlaceholderText, { color: t.brand }]} numberOfLines={2}>
                {orgName}
              </Text>
            </View>
          )}

          <Text style={[styles.kicker, { color: t.subText }]}>{tStr('welcome_org_kicker')}</Text>
          <Text style={[styles.title, { color: t.brandText ?? t.brand }]}>{orgName}</Text>
          <Text style={[styles.subtitle, { color: t.subText }]}>{tStr('welcome_org_subtitle')}</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, t.buttonPrimary]}
          onPress={onPrimary}
          activeOpacity={0.9}
        >
          <Text style={[styles.primaryBtnText, t.buttonPrimaryText]}>
            {hasPlan ? tStr('welcome_org_cta_panel') : tStr('welcome_org_cta_plans')}
          </Text>
        </TouchableOpacity>

        {!hasPlan ? (
          <TouchableOpacity style={styles.linkRow} onPress={onSkipToPanel} activeOpacity={0.85}>
            <Text style={[styles.linkText, { color: t.brand }]}>{tStr('welcome_org_skip_to_panel')}</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={[styles.hint, { color: t.placeholder }]}>{tStr('welcome_org_branding_hint')}</Text>
      </ScrollView>
    </BackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { fontSize: 14 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  hero: { alignItems: 'center', marginBottom: 28 },
  logo: { width: 200, height: 120, marginBottom: 16 },
  logoPlaceholder: {
    width: 200,
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  kicker: { fontSize: 13, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, maxWidth: 340 },
  primaryBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '800' },
  linkRow: { alignItems: 'center', marginTop: 18, paddingVertical: 8 },
  linkText: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 28, lineHeight: 18 },
});
