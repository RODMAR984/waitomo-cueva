import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import BackgroundWrapper from '../components/BackgroundWrapper';
import BackNavButton from '../components/BackNavButton';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { getTermsBody } from '../content/legal';
import { WEB_CONTENT_MAX_WIDTH } from '../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';

export default function TermsScreen({ navigation }) {
  const { profile } = useAuth() || {};
  const { t } = useThemeContext();
  const { locale, t: tStr } = useLocale();

  const body = useMemo(() => getTermsBody(locale), [locale]);

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
        title: {
          fontSize: MOBILE_TYPE.title,
          fontWeight: '700',
          color: t.text,
          marginBottom: MOBILE_SPACING.sm,
          textAlign: 'center',
        },
        subtitle: {
          fontSize: MOBILE_TYPE.caption,
          color: t.subText,
          textAlign: 'center',
          marginBottom: MOBILE_SPACING.lg,
        },
        body: {
          fontSize: MOBILE_TYPE.body,
          color: t.subText,
          lineHeight: 22,
        },
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
          <Text style={styles.title}>{tStr('terms_title')}</Text>
          <Text style={styles.subtitle}>{tStr('legal_last_updated_label')} 2026-04-16</Text>
          <Text style={styles.body}>{body}</Text>

          <BackNavButton onPress={() => navigation.goBack()} label={tStr('config_back')} style={styles.backButton} />
        </View>
      </ScrollView>
    </BackgroundWrapper>
  );
}
