import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import BackgroundWrapper from '../components/BackgroundWrapper';
import BackNavButton from '../components/BackNavButton';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { getPrivacyBody } from '../content/legal';
import { WEB_CONTENT_MAX_WIDTH, WEB_PANEL_RADIUS } from '../theme/webSpec';

export default function PrivacyScreen({ navigation }) {
  const { profile } = useAuth() || {};
  const { t } = useThemeContext();
  const { locale, t: tStr } = useLocale();

  const body = useMemo(() => getPrivacyBody(locale), [locale]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 80,
          paddingBottom: 40,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        panel: {
          borderRadius: WEB_PANEL_RADIUS,
          padding: 18,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        title: {
          fontSize: 22,
          fontWeight: '700',
          color: t.text,
          marginBottom: 6,
          textAlign: 'center',
        },
        subtitle: {
          fontSize: 12,
          color: t.subText,
          textAlign: 'center',
          marginBottom: 16,
        },
        body: {
          fontSize: 14,
          color: t.subText,
          lineHeight: 22,
        },
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
          <Text style={styles.title}>{tStr('privacy_title')}</Text>
          <Text style={styles.subtitle}>{tStr('legal_last_updated_label')} 2026-04-16</Text>
          <Text style={styles.body}>{body}</Text>

          <BackNavButton onPress={() => navigation.goBack()} label={tStr('config_back')} style={styles.backButton} />
        </View>
      </ScrollView>
    </BackgroundWrapper>
  );
}
