// 5.3 — Cuatro métricas operativas (RPC staff_org_dashboard_metrics).

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import useStaffWebHideInlineBack from '../../hooks/useStaffWebHideInlineBack';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE, screenHeaderTopPadding } from '../../theme/mobileSpec';
import { ADMIN_PANEL_GUTTER, ADMIN_SECTION_GAP } from '../../theme/adminSpec';

export default function AdminReportesScreen() {
  const navigation = useNavigation();
  const hideInlineBack = useStaffWebHideInlineBack();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { organization, profile } = useAuth() || {};
  const orgId = organization?.id ?? profile?.organization_id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState(null);

  const load = useCallback(async () => {
    if (!orgId) {
      setMetrics(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('staff_org_dashboard_metrics', { p_org_id: orgId });
      if (error) throw error;
      setMetrics(data && typeof data === 'object' ? data : null);
    } catch {
      setMetrics(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: screenHeaderTopPadding(insets.top),
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingBottom: 8,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        backBtn: { padding: 8, marginRight: 4 },
        title: { flex: 1, color: t.text, fontSize: MOBILE_TYPE.title, fontWeight: '900' },
        scroll: { paddingHorizontal: MOBILE_SPACING.lg, paddingBottom: 32, width: '100%', maxWidth: WEB_CONTENT_MAX_WIDTH, alignSelf: 'center' },
        hint: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginBottom: ADMIN_SECTION_GAP, lineHeight: 18 },
        grid: { flexDirection: 'row', flexWrap: 'wrap', gap: ADMIN_PANEL_GUTTER },
        card: {
          width: '47%',
          minWidth: 140,
          flexGrow: 1,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
          padding: 14,
        },
        cardVal: { color: t.text, fontSize: MOBILE_TYPE.kpi, fontWeight: '900', marginTop: 4 },
        cardLab: { color: t.subText, fontSize: MOBILE_TYPE.caption, fontWeight: '700', marginTop: 6 },
      }),
    [insets.top, t],
  );

  const ok = metrics?.ok === true;
  const cards = ok
    ? [
        ['active_clients', metrics.active_clients],
        ['bookings_scheduled_7d', metrics.bookings_scheduled_7d],
        ['active_passes', metrics.active_passes],
        ['classes_attended_30d', metrics.classes_attended_30d],
      ]
    : [];

  return (
    <BackgroundWrapper screen="Admin">
      <View style={styles.header}>
        {!hideInlineBack ? (
          <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} style={styles.backBtn} />
        ) : null}
        <Text style={styles.title}>{tStr('admin_reportes_title')}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={styles.hint}>{tStr('admin_reportes_hint')}</Text>
        {loading ? (
          <ActivityIndicator color={t.brand} />
        ) : !ok ? (
          <Text style={styles.hint}>{tStr('admin_reportes_empty')}</Text>
        ) : (
          <View style={styles.grid}>
            {cards.map(([key, val]) => (
              <View key={key} style={styles.card}>
                <Text style={styles.cardVal}>{String(val ?? 0)}</Text>
                <Text style={styles.cardLab}>{tStr(`admin_reportes_card_${key}`)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </BackgroundWrapper>
  );
}
