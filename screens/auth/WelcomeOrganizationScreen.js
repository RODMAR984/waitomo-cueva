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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenShell from '../../components/ScreenShell';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { resolveOrgLogoUri } from '../../utils/resolveOrgLogoUri';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import NeoPanel from '../../components/NeoPanel';

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
      <ScreenShell screen="neutral">
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
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      screen="OrgWelcome"
      scroll
      scrollProps={{
        contentContainerStyle: [
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
        ],
        keyboardShouldPersistTaps: 'handled',
      }}
    >
        <NeoPanel style={[styles.panel, { backgroundColor: t.boxBg, borderColor: t.overlayBorder }]}>
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
        </NeoPanel>

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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: MOBILE_SPACING.xxl },
  muted: { fontSize: MOBILE_TYPE.body },
  scroll: {
    paddingHorizontal: MOBILE_SPACING.xxl,
    width: '100%',
    maxWidth: WEB_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  panel: {
    borderWidth: 1,
    borderRadius: MOBILE_RADII.lg,
    padding: MOBILE_SPACING.xl,
    marginBottom: MOBILE_SPACING.xl,
  },
  hero: { alignItems: 'center' },
  logo: { width: 200, height: 120, marginBottom: MOBILE_SPACING.lg },
  logoPlaceholder: {
    width: 200,
    minHeight: 88,
    borderWidth: 1,
    borderRadius: MOBILE_RADII.lg,
    padding: MOBILE_SPACING.lg,
    marginBottom: MOBILE_SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: { fontSize: MOBILE_TYPE.title - 4, fontWeight: '800', textAlign: 'center' },
  kicker: { fontSize: MOBILE_TYPE.caption, fontWeight: '600', letterSpacing: 0.6, marginBottom: MOBILE_SPACING.sm },
  title: {
    fontSize: MOBILE_TYPE.title + 4,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: { fontSize: MOBILE_TYPE.bodyStrong, lineHeight: 22, textAlign: 'center', marginTop: MOBILE_SPACING.md, maxWidth: 340 },
  primaryBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MOBILE_SIZES.controlHeightLg,
    paddingVertical: MOBILE_SPACING.md,
    borderRadius: MOBILE_RADII.lg,
    marginTop: MOBILE_SPACING.sm,
  },
  primaryBtnText: { fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800' },
  linkRow: { alignItems: 'center', marginTop: MOBILE_SPACING.xl - 2, paddingVertical: MOBILE_SPACING.sm },
  linkText: { fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '600' },
  hint: { fontSize: MOBILE_TYPE.caption, textAlign: 'center', marginTop: MOBILE_SPACING.xxl + MOBILE_SPACING.sm, lineHeight: 18 },
});
