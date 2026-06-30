// Lectura de `platform_audit_log` (append-only) para admins de plataforma.

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenShell from '../../components/ScreenShell';
import BackNavButton from '../../components/BackNavButton';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import useStaffWebHideInlineBack from '../../hooks/useStaffWebHideInlineBack';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE, screenHeaderTopPadding } from '../../theme/mobileSpec';

function isMissingRelation(err) {
  const c = String(err?.code || '');
  const m = String(err?.message || '').toLowerCase();
  return c === '42P01' || m.includes('does not exist');
}

export default function SuperadminAuditLogScreen() {
  const navigation = useNavigation();
  const hideInlineBack = useStaffWebHideInlineBack();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { isPlatformAdmin } = useAuth() || {};

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  const allowed = typeof isPlatformAdmin === 'function' ? isPlatformAdmin() : false;

  const load = useCallback(async () => {
    if (!allowed) {
      setRows([]);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('platform_audit_log')
        .select('id, created_at, actor_id, action, entity_type, entity_id, payload')
        .order('created_at', { ascending: false })
        .limit(150);
      if (e) throw e;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      if (isMissingRelation(e)) setError('migration');
      else setError(e?.message || 'err');
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allowed]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: 'transparent' },
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
        title: { flex: 1, color: t.text, fontSize: MOBILE_TYPE.title, fontWeight: '900' },
        listWrap: { flex: 1, width: '100%', maxWidth: WEB_CONTENT_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: MOBILE_SPACING.lg },
        hint: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginBottom: MOBILE_SPACING.md, lineHeight: 18 },
        err: { color: t.brand, fontSize: MOBILE_TYPE.body, marginBottom: MOBILE_SPACING.md },
        row: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          padding: MOBILE_SPACING.md,
          marginBottom: MOBILE_SPACING.sm,
          backgroundColor: t.boxBg,
        },
        rowTitle: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '700' },
        rowSub: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 4 },
        payload: { color: t.placeholder, fontSize: MOBILE_TYPE.meta, marginTop: 6, lineHeight: 16 },
        empty: { color: t.subText, fontSize: MOBILE_TYPE.body, textAlign: 'center', marginTop: 24 },
      }),
    [t, insets.top],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const payloadStr = JSON.stringify(item.payload ?? {}).slice(0, 220);
      return (
        <View style={styles.row}>
          <Text style={styles.rowTitle}>
            {item.action || '—'} · {String(item.created_at || '').replace('T', ' ').slice(0, 19)}
          </Text>
          <Text style={styles.rowSub}>
            {(item.entity_type || '—') + (item.entity_id ? ` · ${item.entity_id}` : '')}
            {item.actor_id ? ` · actor ${String(item.actor_id).slice(0, 8)}…` : ''}
          </Text>
          {payloadStr !== '{}' ? <Text style={styles.payload}>{payloadStr}</Text> : null}
        </View>
      );
    },
    [styles],
  );

  if (!allowed) {
    return (
      <ScreenShell screen="Admin">
        <View style={[styles.listWrap, { paddingTop: screenHeaderTopPadding(insets.top) }]}>
          <BackNavButton onPress={() => navigation.goBack()} />
          <Text style={styles.err}>{tStr('superadmin_access_denied')}</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell screen="Admin">
      <View style={styles.root} testID="screen-superadmin-audit">
        <View style={styles.header}>
          {!hideInlineBack ? (
            <BackNavButton
              testID="superadmin-nav-to-hub"
              onPress={() => navigation.navigate('Superadmin')}
              label={tStr('superadmin_back_hub')}
            />
          ) : null}
          <Text style={styles.title}>{tStr('superadmin_audit_title')}</Text>
        </View>
        <View style={styles.listWrap}>
          <Text style={styles.hint}>{tStr('superadmin_audit_hint')}</Text>
          {error === 'migration' ? <Text style={styles.err}>{tStr('superadmin_data_migration_hint')}</Text> : null}
          {error && error !== 'migration' ? <Text style={styles.err}>{tStr('superadmin_audit_load_error')}</Text> : null}
          {loading && !refreshing ? (
            <ActivityIndicator color={t.brand} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(it) => String(it.id)}
              renderItem={renderItem}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              ListEmptyComponent={
                !loading && !error ? <Text style={styles.empty}>{tStr('superadmin_audit_empty')}</Text> : null
              }
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          )}
        </View>
      </View>
    </ScreenShell>
  );
}
