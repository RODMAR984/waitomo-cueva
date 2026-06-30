// Pantallas tema del panel plataforma hasta conectar datos reales (vista SQL / CRUD).

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '../../components/ScreenShell';
import BackNavButton from '../../components/BackNavButton';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE, screenHeaderTopPadding } from '../../theme/mobileSpec';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';

const VALID_TOPICS = new Set(['orgs', 'tickets', 'flags', 'mrr', 'audit', 'broadcast']);

export default function SuperadminTopicScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const raw = String(route.params?.topic || '').toLowerCase();
  const topic = VALID_TOPICS.has(raw) ? raw : 'orgs';
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  const title = tStr(`superadmin_topic_${topic}_title`);
  const body = tStr(`superadmin_topic_${topic}_body`);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          flexGrow: 1,
          paddingHorizontal: MOBILE_SPACING.xl,
          paddingBottom: MOBILE_SPACING.xl,
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
          width: '100%',
        },
        title: { color: t.text, fontSize: MOBILE_TYPE.title, fontWeight: '800', marginBottom: MOBILE_SPACING.sm },
        body: { color: t.subText, fontSize: MOBILE_TYPE.body, lineHeight: 22, marginBottom: MOBILE_SPACING.lg },
        panel: {
          padding: MOBILE_SPACING.lg,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        hint: { color: t.placeholder, fontSize: MOBILE_TYPE.caption, lineHeight: 18 },
        backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: MOBILE_SPACING.md },
      }),
    [t],
  );

  return (
    <ScreenShell
      screen="Admin"
      scroll
      scrollProps={{
        contentContainerStyle: [styles.scroll, { paddingTop: screenHeaderTopPadding(insets.top) }],
        keyboardShouldPersistTaps: 'handled',
      }}
    >
        <View style={styles.backRow}>
          <BackNavButton onPress={() => navigation.navigate('Superadmin')} label={tStr('superadmin_back_hub')} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.panel}>
          <Ionicons name="construct-outline" size={28} color={t.brand} style={{ marginBottom: 8 }} />
          <Text style={styles.hint}>{tStr('superadmin_topic_common_hint')}</Text>
        </View>
        {topic === 'broadcast' ? (
          <View style={[styles.panel, { marginTop: MOBILE_SPACING.md, opacity: 0.92 }]}>
            <Text style={[styles.body, { marginBottom: 0 }]}>{tStr('superadmin_topic_broadcast_legal')}</Text>
          </View>
        ) : null}
    </ScreenShell>
  );
}
