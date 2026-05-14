// Hub panel plataforma FitEngine — ver docs/ROADMAP_SUPERADMIN_PLATFORM_PANEL.md

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import useSuperadminHubTiles from '../../hooks/useSuperadminHubTiles';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE, screenHeaderTopPadding } from '../../theme/mobileSpec';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';

export default function SuperadminScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { isPlatformAdmin } = useAuth() || {};
  const hubTiles = useSuperadminHubTiles(navigation);

  const allowed = typeof isPlatformAdmin === 'function' ? isPlatformAdmin() : false;

  const cols = width >= 900 ? 3 : width >= 560 ? 2 : 1;
  const gap = MOBILE_SPACING.md;
  const innerPad = MOBILE_SPACING.xl * 2;
  const usableW = Math.min(width, WEB_CONTENT_MAX_WIDTH) - innerPad;
  const cardWidth = Math.max(160, Math.floor((usableW - gap * (cols - 1)) / cols));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, width: '100%' },
        header: {
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
          paddingHorizontal: MOBILE_SPACING.xl,
          paddingBottom: MOBILE_SPACING.sm,
        },
        scrollBody: {
          flexGrow: 1,
          paddingHorizontal: MOBILE_SPACING.xl,
          paddingTop: MOBILE_SPACING.xs,
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
          width: '100%',
        },
        title: { color: t.text, fontSize: MOBILE_TYPE.title, fontWeight: '800', marginBottom: MOBILE_SPACING.sm },
        body: { color: t.subText, fontSize: MOBILE_TYPE.body, lineHeight: 22, marginBottom: MOBILE_SPACING.lg },
        grid: { flexDirection: 'row', flexWrap: 'wrap', gap },
        card: {
          width: cardWidth,
          marginBottom: 0,
        },
        cardInner: {
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
          padding: MOBILE_SPACING.lg,
          minHeight: 112,
        },
        cardTitle: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800', marginTop: MOBILE_SPACING.sm },
        cardSub: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 4, lineHeight: 18 },
        deny: { color: t.brand, fontWeight: '700', fontSize: MOBILE_TYPE.body },
      }),
    [t, cardWidth, gap],
  );

  if (!allowed) {
    return (
      <BackgroundWrapper screen="Admin">
        <View style={styles.root}>
          <View style={[styles.header, { paddingTop: screenHeaderTopPadding(insets.top) }]}>
            <BackNavButton onPress={() => navigation.goBack()} />
          </View>
          <ScrollView
            contentContainerStyle={[
              styles.scrollBody,
              { paddingBottom: Math.max(insets.bottom, MOBILE_SPACING.xl) },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.deny}>{tStr('superadmin_access_denied')}</Text>
          </ScrollView>
        </View>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper screen="Admin">
      <View testID="superadmin-hub-root" style={styles.root}>
        <View style={[styles.header, { paddingTop: screenHeaderTopPadding(insets.top) }]}>
          <BackNavButton
            onPress={() => navigation.navigate('AdminLite')}
            label={tStr('superadmin_back_admin')}
          />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollBody,
            { paddingBottom: Math.max(insets.bottom, MOBILE_SPACING.xl) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{tStr('superadmin_screen_title')}</Text>
          <Text style={styles.body}>{tStr('superadmin_screen_intro')}</Text>
          <View style={styles.grid}>
            {hubTiles.map((tile) => (
              <View key={tile.key} style={styles.card}>
                <Pressable
                  testID={`superadmin-hub-tile-${tile.key}`}
                  onPress={tile.onPress}
                  style={({ pressed }) => [styles.cardInner, pressed && { opacity: 0.88 }]}
                  accessibilityRole="button"
                >
                  <Ionicons name={tile.ion} size={26} color={t.brand} />
                  <Text style={styles.cardTitle}>{tStr(tile.titleKey)}</Text>
                  <Text style={styles.cardSub}>{tStr(tile.subKey)}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </BackgroundWrapper>
  );
}
