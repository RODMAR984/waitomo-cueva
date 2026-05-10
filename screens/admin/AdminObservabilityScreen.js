import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import useStaffWebHideInlineBack from '../../hooks/useStaffWebHideInlineBack';
import { supabase } from '../../supabaseClient';
import { WEB_CONTENT_MAX_WIDTH, WEB_PANEL_RADIUS } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import {
  clearObservabilityEvents,
  getObservabilitySnapshot,
  getUnsyncedObservabilityEvents,
  markObservabilityEventsSynced,
} from '../../utils/observability';

export default function AdminObservabilityScreen({ navigation }) {
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const hideInlineBack = useStaffWebHideInlineBack();
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [syncFilter, setSyncFilter] = useState('all');

  const snapshot = useMemo(() => getObservabilitySnapshot(), [refreshTick]);
  const unsynced = useMemo(() => getUnsyncedObservabilityEvents(100), [refreshTick]);

  const stats = useMemo(() => {
    const total = snapshot.events.length;
    const synced = snapshot.events.filter((e) => e.synced).length;
    const errors = snapshot.events.filter((e) => e.type === 'error').length;
    return { total, synced, unsynced: total - synced, errors };
  }, [snapshot.events]);

  const refresh = () => setRefreshTick((x) => x + 1);
  const syncedCount = Math.max(0, stats.total - stats.unsynced);
  const maxWidth = Platform.OS === 'web' ? WEB_CONTENT_MAX_WIDTH : undefined;

  const events = useMemo(() => snapshot.events.slice().reverse(), [snapshot.events]);
  const perfMetricDefs = useMemo(
    () => [
      { name: 'calendario_slots_load_success', label: tStr('admin_observ_perf_cal_slots') },
      { name: 'client_abonos_load_success', label: tStr('admin_observ_perf_client_abonos') },
      { name: 'client_news_load_success', label: tStr('admin_observ_perf_client_news') },
      { name: 'web_vital_lcp', label: tStr('admin_observ_perf_web_lcp') },
      { name: 'web_vital_fcp', label: tStr('admin_observ_perf_web_fcp') },
      { name: 'web_vital_ttfb', label: tStr('admin_observ_perf_web_ttfb') },
      { name: 'web_vital_inp', label: tStr('admin_observ_perf_web_inp') },
    ],
    [tStr],
  );
  const perfStats = useMemo(() => {
    return perfMetricDefs.map((def) => {
      const rows = snapshot.events.filter(
        (e) => e?.name === def.name && Number.isFinite(Number(e?.payload?.durationMs)),
      );
      const durations = rows.map((e) => Number(e.payload.durationMs)).filter((n) => Number.isFinite(n) && n >= 0);
      if (!durations.length) {
        return { ...def, count: 0, avgMs: null, p95Ms: null };
      }
      const sorted = durations.slice().sort((a, b) => a - b);
      const avgMs = Math.round(sorted.reduce((acc, n) => acc + n, 0) / sorted.length);
      const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
      const p95Ms = Math.round(sorted[p95Index]);
      return { ...def, count: sorted.length, avgMs, p95Ms };
    });
  }, [perfMetricDefs, snapshot.events]);
  const slowestEvents = useMemo(() => {
    return snapshot.events
      .filter((e) => Number.isFinite(Number(e?.payload?.durationMs)))
      .map((e) => ({
        id: e.id,
        name: e.name,
        ts: e.ts,
        durationMs: Math.round(Number(e.payload.durationMs)),
      }))
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 5);
  }, [snapshot.events]);
  const filteredEvents = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    return events.filter((e) => {
      if (typeFilter === 'error' && e.type !== 'error') return false;
      if (typeFilter === 'event' && e.type !== 'event') return false;
      if (syncFilter === 'pending' && e.synced) return false;
      if (syncFilter === 'synced' && !e.synced) return false;
      if (!q) return true;
      const raw = `${String(e.name || '')} ${String(e.type || '')} ${String(e.ts || '')} ${String(
        e.errorMessage || '',
      )} ${JSON.stringify(e.payload || {})}`.toLowerCase();
      return raw.includes(q);
    });
  }, [events, query, syncFilter, typeFilter]);

  const copySnapshot = async () => {
    try {
      await Clipboard.setStringAsync(
        JSON.stringify(
          {
            context: {
              userId: snapshot.userId,
              role: snapshot.role,
              organizationId: snapshot.organizationId,
            },
            events: snapshot.events,
          },
          null,
          2,
        ),
      );
      Alert.alert(tStr('gym_config_copied_title'), tStr('admin_observ_copy_ok'));
    } catch {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('admin_observ_copy_fail'));
    }
  };

  const syncToBackend = async () => {
    if (unsynced.length === 0) {
      Alert.alert(tStr('admin_observ_sync_title'), tStr('admin_observ_sync_nothing'));
      return;
    }
    setBusy(true);
    try {
      const payload = {
        events: unsynced.map((e) => ({
          id: e.id,
          type: e.type,
          name: e.name,
          ts: e.ts,
          role: e.role || null,
          organization_id: e.organizationId || null,
          payload: e.payload || {},
          error_message: e.errorMessage || null,
          stack: e.stack || null,
        })),
      };
      const { data, error } = await supabase.functions.invoke('ingest-observability', {
        body: payload,
      });
      if (error) throw error;
      const syncedIds = Array.isArray(data?.synced_ids) ? data.synced_ids : unsynced.map((e) => e.id);
      markObservabilityEventsSynced(syncedIds);
      refresh();
      Alert.alert(
        tStr('admin_observ_sync_title'),
        tStr('admin_observ_sync_ok').replace('{{n}}', String(syncedIds.length)),
      );
    } catch (e) {
      Alert.alert(
        tStr('gym_config_alert_title_error'),
        `${tStr('admin_observ_sync_fail')}\n${String(e?.message || '')}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const clearSynced = () => {
    if (syncedCount === 0) return;
    clearObservabilityEvents({ onlySynced: true });
    refresh();
  };

  const clearAll = () => {
    Alert.alert(tStr('admin_observ_clear_all_title'), tStr('admin_observ_clear_all_body'), [
      { text: tStr('common_cancel'), style: 'cancel' },
      {
        text: tStr('admin_observ_clear_all_confirm'),
        style: 'destructive',
        onPress: () => {
          clearObservabilityEvents();
          refresh();
        },
      },
    ]);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, padding: MOBILE_SPACING.xl, paddingTop: 56 },
        contentMax: { width: '100%', alignSelf: 'center', maxWidth },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
        title: { color: t.text, fontSize: MOBILE_TYPE.title, fontWeight: '800' },
        iconBtn: { marginLeft: 0, width: 'auto', maxWidth: 180, alignSelf: 'flex-start' },
        statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
        statCard: {
          minWidth: 120,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: WEB_PANEL_RADIUS,
          padding: 10,
          backgroundColor: t.boxBg,
        },
        statLabel: { color: t.subText, fontSize: MOBILE_TYPE.caption },
        statValue: { color: t.text, fontSize: 18, fontWeight: '800' },
        perfWrap: {
          marginBottom: 14,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          padding: 10,
          backgroundColor: t.boxBg,
        },
        perfTitle: { color: t.text, fontSize: MOBILE_TYPE.body, fontWeight: '800', marginBottom: 8 },
        perfCardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        perfCard: {
          minWidth: 170,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          paddingHorizontal: 10,
          paddingVertical: 8,
          backgroundColor: t.inputBg,
        },
        perfName: { color: t.text, fontSize: MOBILE_TYPE.caption, fontWeight: '700', marginBottom: 4 },
        perfMeta: { color: t.subText, fontSize: 11 },
        slowWrap: {
          marginBottom: 14,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          padding: 10,
          backgroundColor: t.boxBg,
        },
        slowTitle: { color: t.text, fontSize: MOBILE_TYPE.body, fontWeight: '800', marginBottom: 8 },
        slowRow: {
          borderTopWidth: 1,
          borderTopColor: t.overlayBorder,
          paddingVertical: 7,
        },
        slowRowFirst: { borderTopWidth: 0, paddingTop: 2 },
        slowName: { color: t.text, fontSize: MOBILE_TYPE.caption, fontWeight: '700' },
        slowMeta: { color: t.subText, fontSize: 11, marginTop: 2 },
        actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
        actionBtn: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          paddingHorizontal: MOBILE_SPACING.md,
          paddingVertical: 10,
          backgroundColor: t.inputBg,
        },
        actionBtnPrimary: { ...t.buttonPrimary, borderColor: 'transparent' },
        actionBtnDisabled: { opacity: 0.45 },
        actionTxt: { color: t.text, fontSize: MOBILE_TYPE.body, fontWeight: '700' },
        actionTxtPrimary: { ...t.buttonPrimaryText, fontSize: MOBILE_TYPE.body, fontWeight: '800' },
        searchInput: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          paddingHorizontal: MOBILE_SPACING.md,
          paddingVertical: 10,
          color: t.text,
          backgroundColor: t.inputBg,
          marginBottom: 10,
        },
        filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
        filterPill: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.pill,
          paddingHorizontal: 10,
          paddingVertical: 7,
          backgroundColor: t.inputBg,
        },
        filterPillOn: {
          borderColor: t.brand,
          backgroundColor: `${t.brand}1A`,
        },
        filterTxt: { color: t.subText, fontSize: MOBILE_TYPE.caption, fontWeight: '700' },
        filterTxtOn: { color: t.brand },
        resultLine: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginBottom: 8 },
        list: { flex: 1, borderWidth: 1, borderColor: t.overlayBorder, borderRadius: MOBILE_RADII.md, backgroundColor: t.boxBg },
        row: {
          borderBottomWidth: 1,
          borderBottomColor: t.overlayBorder,
          paddingHorizontal: MOBILE_SPACING.md,
          paddingVertical: 10,
        },
        rowTitle: { color: t.text, fontSize: MOBILE_TYPE.body, fontWeight: '700' },
        rowSub: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 2 },
        rowPayload: { color: t.placeholder, fontSize: 11, marginTop: 4, lineHeight: 16 },
      }),
    [t, maxWidth],
  );

  const typeFilters = [
    { id: 'all', label: tStr('admin_observ_filter_all') },
    { id: 'event', label: tStr('admin_observ_filter_events') },
    { id: 'error', label: tStr('admin_observ_filter_errors') },
  ];
  const syncFilters = [
    { id: 'all', label: tStr('admin_observ_filter_all') },
    { id: 'pending', label: tStr('admin_observ_filter_pending') },
    { id: 'synced', label: tStr('admin_observ_filter_synced') },
  ];

  return (
    <BackgroundWrapper screen="admin">
      <View style={styles.root}>
        <View style={styles.contentMax}>
        <View style={styles.header}>
          {!hideInlineBack ? (
            <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} style={styles.iconBtn} />
          ) : null}
          <Text style={styles.title}>{tStr('admin_observ_title')}</Text>
          <View style={{ width: 20 }} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{tStr('admin_observ_total')}</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{tStr('admin_observ_unsynced')}</Text>
            <Text style={styles.statValue}>{stats.unsynced}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{tStr('admin_observ_errors')}</Text>
            <Text style={styles.statValue}>{stats.errors}</Text>
          </View>
        </View>

        <View style={styles.perfWrap}>
          <Text style={styles.perfTitle}>{tStr('admin_observ_perf_title')}</Text>
          <View style={styles.perfCardsRow}>
            {perfStats.map((m) => (
              <View key={m.name} style={styles.perfCard}>
                <Text style={styles.perfName}>{m.label}</Text>
                {m.count > 0 ? (
                  <>
                    <Text style={styles.perfMeta}>
                      {tStr('admin_observ_perf_avg').replace('{{n}}', String(m.avgMs))}
                    </Text>
                    <Text style={styles.perfMeta}>
                      {tStr('admin_observ_perf_p95').replace('{{n}}', String(m.p95Ms))}
                    </Text>
                    <Text style={styles.perfMeta}>
                      {tStr('admin_observ_perf_count').replace('{{n}}', String(m.count))}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.perfMeta}>{tStr('admin_observ_perf_no_data')}</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.slowWrap}>
          <Text style={styles.slowTitle}>{tStr('admin_observ_slowest_title')}</Text>
          {slowestEvents.length === 0 ? (
            <Text style={styles.perfMeta}>{tStr('admin_observ_perf_no_data')}</Text>
          ) : (
            slowestEvents.map((ev, idx) => (
              <View key={ev.id} style={[styles.slowRow, idx === 0 && styles.slowRowFirst]}>
                <Text style={styles.slowName}>
                  #{idx + 1} · {ev.name}
                </Text>
                <Text style={styles.slowMeta}>
                  {tStr('admin_observ_perf_duration').replace('{{n}}', String(ev.durationMs))}
                </Text>
                <Text style={styles.slowMeta}>{ev.ts}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={syncToBackend} disabled={busy}>
            <Text style={styles.actionTxtPrimary}>{tStr('admin_observ_sync_btn')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={copySnapshot}>
            <Text style={styles.actionTxt}>{tStr('admin_observ_copy_btn')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, syncedCount === 0 && styles.actionBtnDisabled]}
            onPress={clearSynced}
            disabled={syncedCount === 0}
          >
            <Text style={styles.actionTxt}>{tStr('admin_observ_clear_synced_btn')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={clearAll}>
            <Text style={styles.actionTxt}>{tStr('admin_observ_clear_all_btn')}</Text>
          </TouchableOpacity>
        </View>

        {busy ? <ActivityIndicator color={t.brand} size="small" style={{ marginBottom: 10 }} /> : null}

        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={tStr('admin_observ_search_ph')}
          placeholderTextColor={t.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.filterRow}>
          {typeFilters.map((f) => {
            const on = typeFilter === f.id;
            return (
              <Pressable key={`type-${f.id}`} style={[styles.filterPill, on && styles.filterPillOn]} onPress={() => setTypeFilter(f.id)}>
                <Text style={[styles.filterTxt, on && styles.filterTxtOn]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.filterRow}>
          {syncFilters.map((f) => {
            const on = syncFilter === f.id;
            return (
              <Pressable key={`sync-${f.id}`} style={[styles.filterPill, on && styles.filterPillOn]} onPress={() => setSyncFilter(f.id)}>
                <Text style={[styles.filterTxt, on && styles.filterTxtOn]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.resultLine}>
          {tStr('admin_observ_results').replace('{{n}}', String(filteredEvents.length))}
        </Text>

        <FlatList
          style={styles.list}
          data={filteredEvents}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 6 }}
          ListEmptyComponent={
            <View style={styles.row}>
              <Text style={styles.rowSub}>
                {snapshot.events.length === 0 ? tStr('admin_observ_empty') : tStr('admin_observ_filtered_empty')}
              </Text>
            </View>
          }
          renderItem={({ item: e }) => (
            <View style={styles.row}>
              <Text style={styles.rowTitle}>
                {String(e.type || 'event').toUpperCase()} · {e.name} {e.synced ? '✓' : '•'}
              </Text>
              <Text style={styles.rowSub}>{e.ts}</Text>
              <Text style={styles.rowPayload} numberOfLines={4}>
                {JSON.stringify(e.payload || {})}
              </Text>
            </View>
          )}
        />
        </View>
      </View>
    </BackgroundWrapper>
  );
}
