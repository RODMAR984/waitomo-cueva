import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { getTermsBody } from '../content/legal';

export default function TermsScreen({ navigation }) {
  const { profile } = useAuth() || {};
  const { t } = useThemeContext();
  const { locale, t: tStr } = useLocale();

  const body = useMemo(() => getTermsBody(locale), [locale]);

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
          <Text style={styles.title}>{tStr('terms_title')}</Text>
          <Text style={styles.subtitle}>{tStr('legal_last_updated_label')} 2026-04-16</Text>
          <Text style={styles.body}>{body}</Text>

          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.9}>
            <Ionicons name="arrow-back" size={18} color={t.primaryText} />
            <Text style={styles.backButtonText}>{tStr('config_back')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </BackgroundWrapper>
  );
}
