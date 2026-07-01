// Listado multi-org (vista `platform_orgs_overview`) — panel plataforma.

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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

export default function SuperadminOrgsScreen() {
  const navigation = useNavigation();
  const hideInlineBack = useStaffWebHideInlineBack();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { isPlatformAdmin, startImpersonation } = useAuth() || {};

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
        .from('platform_orgs_overview')
        .select(
          'organization_id, name, type, active, plan_fitengine, subscription_status, trial_expires_at, country, business_model, owner_id, created_at, client_memberships_count, staff_memberships_count',
        )
        .order('name', { ascending: true });
      if (e) throw e;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      if (isMissingRelation(e)) {
        setError('migration');
      } else {
        setError(e?.message || 'err');
      }
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

  const copyId = async (id) => {
    try {
      await Clipboard.setStringAsync(String(id));
      Alert.alert(tStr('gym_config_copied_title'), tStr('superadmin_orgs_copied'));
    } catch {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('superadmin_orgs_copy_fail'));
    }
  };

  const enterAsOrg = useCallback(
    async (orgId) => {
      const res = await startImpersonation?.(orgId);
      if (res?.ok) {
        navigation.navigate('AdminLite');
        return;
      }
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('impersonation_start_failed'));
    },
    [navigation, startImpersonation, tStr],
  );

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
        rowTitle: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800' },
        rowMeta: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 4 },
        rowCounts: { color: t.placeholder, fontSize: MOBILE_TYPE.meta, marginTop: 6 },
        inactive: { color: t.brand, fontWeight: '700', fontSize: MOBILE_TYPE.caption },
        rowActions: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          marginTop: MOBILE_SPACING.sm,
        },
        rowAction: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.bg,
        },
        rowActionLabel: { color: t.brand, fontSize: MOBILE_TYPE.meta, fontWeight: '800' },
        empty: { color: t.subText, fontSize: MOBILE_TYPE.body, textAlign: 'center', marginTop: 24 },
      }),
    [t, insets.top],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.rowTitle}>{item.name || '—'}</Text>
          {!item.active ? <Text style={styles.inactive}>{tStr('superadmin_orgs_inactive')}</Text> : null}
        </View>
        <Text style={styles.rowMeta}>
          {item.type || '—'} · {item.plan_fitengine || '—'}
          {item.subscription_status ? ` · ${item.subscription_status}` : ''}
          {item.trial_expires_at
            ? ` · trial ${new Date(item.trial_expires_at).toLocaleDateString()}`
            : ''}
          {' · id…'}
          {String(item.organization_id || '').slice(0, 8)}
        </Text>
        <Text style={styles.rowCounts}>
          {tStr('superadmin_orgs_col_clients')}: {item.client_memberships_count ?? 0} ·{' '}
          {tStr('superadmin_orgs_col_staff')}: {item.staff_memberships_count ?? 0}
        </Text>
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={styles.rowAction}
            onPress={() => copyId(item.organization_id)}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Ionicons name="copy-outline" size={18} color={t.brand} />
            <Text style={styles.rowActionLabel}>{tStr('superadmin_orgs_copy_id')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rowAction}
            onPress={() => void enterAsOrg(item.organization_id)}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Ionicons name="log-in-outline" size={18} color={t.brand} />
            <Text style={styles.rowActionLabel}>{tStr('superadmin_orgs_enter')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [styles, tStr, t.brand, copyId, enterAsOrg],
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
    <ScreenShell
      screen="Admin"
      list
      rootStyle={styles.root}
      testID="screen-superadmin-orgs"
      listProps={{
        data: loading && !refreshing ? [] : rows,
        keyExtractor: (it) => String(it.organization_id),
        renderItem,
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
        ListHeaderComponent: (
          <>
            <View style={styles.header}>
              {!hideInlineBack ? (
                <BackNavButton
                  testID="superadmin-nav-to-hub"
                  onPress={() => navigation.navigate('Superadmin')}
                  label={tStr('superadmin_back_hub')}
                />
              ) : null}
              <Text style={styles.title}>{tStr('superadmin_orgs_title')}</Text>
              <TouchableOpacity onPress={onRefresh} accessibilityRole="button">
                <Ionicons name="refresh-outline" size={24} color={t.brand} />
              </TouchableOpacity>
            </View>
            <View style={styles.listWrap}>
              <Text style={styles.hint}>{tStr('superadmin_orgs_hint')}</Text>
              {error === 'migration' ? <Text style={styles.err}>{tStr('superadmin_data_migration_hint')}</Text> : null}
              {error && error !== 'migration' ? <Text style={styles.err}>{tStr('superadmin_orgs_load_error')}</Text> : null}
              {loading && !refreshing ? (
                <ActivityIndicator color={t.brand} style={{ marginTop: 24 }} />
              ) : null}
            </View>
          </>
        ),
        ListEmptyComponent:
          !loading && !error ? <Text style={styles.empty}>{tStr('superadmin_orgs_empty')}</Text> : null,
        contentContainerStyle: { paddingBottom: 40 },
      }}
    />
  );
}
