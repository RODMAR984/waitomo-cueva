// Lista de miembros de la organización actual (memberships + nombres desde profiles).

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
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

const ROLE_LABEL = {
  owner: 'Dueño',
  admin: 'Admin',
  coach: 'Coach',
  superadmin: 'Superadmin',
  cliente: 'Cliente',
};

function mergeMemberships(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const uid = r.user_id;
    if (!uid) continue;
    if (!map.has(uid)) {
      map.set(uid, { user_id: uid, roles: new Set(), active: !!r.active });
    }
    const entry = map.get(uid);
    if (r.role) entry.roles.add(r.role);
    entry.active = entry.active || !!r.active;
  }
  return Array.from(map.values()).map((e) => ({
    user_id: e.user_id,
    roles: [...e.roles],
    active: e.active,
  }));
}

export default function OrgMembersScreen() {
  const navigation = useNavigation();
  const hideInlineBack = useStaffWebHideInlineBack();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { organization } = useAuth();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const orgId = organization?.id;
    if (!orgId) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: mems, error: e1 } = await supabase
        .from('organization_memberships')
        .select('user_id, role, active')
        .eq('organization_id', orgId)
        .order('role', { ascending: true });
      if (e1) throw e1;
      const merged = mergeMemberships(mems || []);
      const ids = merged.map((m) => m.user_id).filter(Boolean);
      if (ids.length === 0) {
        setRows([]);
        return;
      }
      const { data: profs, error: e2 } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', ids);
      if (e2) throw e2;
      const byId = {};
      (profs || []).forEach((p) => {
        byId[p.id] = p;
      });
      const enriched = merged.map((m) => {
        const p = byId[m.user_id];
        const label = (p?.full_name || p?.username || m.user_id).trim();
        return { ...m, displayName: label || m.user_id };
      });
      enriched.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
      setRows(enriched);
    } catch (err) {
      setError(err?.message || String(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: MOBILE_SPACING.xl,
          paddingTop: screenHeaderTopPadding(insets.top),
          paddingBottom: 16,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        backBtn: { padding: 8, marginLeft: -8 },
        title: {
          flex: 1,
          color: t.brandText ?? t.brand,
          fontSize: MOBILE_TYPE.title,
          fontWeight: '800',
        },
        list: { flex: 1, paddingHorizontal: MOBILE_SPACING.xl, paddingBottom: 24, width: '100%', maxWidth: WEB_CONTENT_MAX_WIDTH, alignSelf: 'center' },
        card: {
          borderRadius: MOBILE_RADII.lg,
          paddingVertical: 12,
          paddingHorizontal: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        name: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '700' },
        meta: { color: t.subText, fontSize: MOBILE_TYPE.body, marginTop: 4 },
        rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
        pill: {
          paddingHorizontal: MOBILE_SPACING.sm,
          paddingVertical: 4,
          borderRadius: MOBILE_RADII.sm,
          backgroundColor: t.overlayBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        pillText: { color: t.brand, fontSize: MOBILE_TYPE.caption, fontWeight: '600' },
        inactive: { color: t.danger, fontSize: MOBILE_TYPE.caption, marginTop: 6 },
        empty: { paddingVertical: 40, alignItems: 'center' },
        emptyText: { color: t.placeholder, fontSize: MOBILE_TYPE.bodyStrong, textAlign: 'center' },
        err: { color: t.danger, fontSize: MOBILE_TYPE.body, marginBottom: 12 },
        iconBtn: { padding: 8 },
      }),
    [t, insets.top]
  );

  const formatRoles = (roles) =>
    (roles || [])
      .map((r) => ROLE_LABEL[r] || r)
      .join(' · ');

  const exportCsv = useCallback(async () => {
    if (!rows?.length) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('admin_miembros_empty'));
      return;
    }
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const header = 'user_id,display_name,roles,active';
    const lines = rows.map((r) =>
      [r.user_id, esc(r.displayName), esc(formatRoles(r.roles)), r.active ? 'true' : 'false'].join(','),
    );
    const csv = [header, ...lines].join('\n');
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'miembros.csv';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Clipboard.setStringAsync(csv);
      }
      Alert.alert(tStr('gym_config_copied_title'), tStr('org_members_export_ok'));
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
    }
  }, [rows, tStr]);

  return (
    <BackgroundWrapper screen="admin">
      <View style={{ flex: 1 }} testID="screen-org-members">
      <View style={styles.header}>
        {!hideInlineBack ? (
          <BackNavButton
            testID="org-members-nav-back"
            onPress={() => navigation.goBack()}
            label={tStr('common_back')}
            style={styles.backBtn}
          />
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {tStr('admin_miembros')}
        </Text>
        <TouchableOpacity onPress={exportCsv} style={styles.iconBtn} accessibilityLabel="Export CSV">
          <Ionicons name="download-outline" size={22} color={t.brand} />
        </TouchableOpacity>
        <TouchableOpacity onPress={load} style={styles.iconBtn} accessibilityLabel="Refrescar">
          <Ionicons name="refresh" size={22} color={t.brand} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={t.brand} />
        </View>
      ) : error ? (
        <View style={[styles.list, styles.empty]}>
          <Text style={styles.err}>{error}</Text>
          <Text style={styles.emptyText}>
            Si acabás de desplegar la base, ejecutá la migración «Staff read org memberships» en Supabase.
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={rows}
          keyExtractor={(item) => item.user_id}
          ListHeaderComponent={
            rows.length ? (
              <Text style={{ color: t.subText, fontSize: MOBILE_TYPE.label, lineHeight: 18, marginBottom: 12 }}>
                {tStr('org_member_list_hint')}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{tStr('admin_miembros_empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.82}
              onPress={() =>
                navigation.navigate('OrgMemberDetail', {
                  userId: item.user_id,
                  displayName: item.displayName,
                })
              }
            >
              <Text style={styles.name}>{item.displayName}</Text>
              <Text style={styles.meta} selectable>
                {item.user_id}
              </Text>
              <View style={styles.rolesRow}>
                {item.roles.map((r) => (
                  <View key={r} style={styles.pill}>
                    <Text style={styles.pillText}>{ROLE_LABEL[r] || r}</Text>
                  </View>
                ))}
              </View>
              {!item.active ? <Text style={styles.inactive}>Inactivo</Text> : null}
            </TouchableOpacity>
          )}
        />
      )}
      </View>
    </BackgroundWrapper>
  );
}
