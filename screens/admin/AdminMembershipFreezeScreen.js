// Staff: congelar / descongelar membresías (user_abonos) cuando la org tiene membership_freeze_enabled.

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Platform,
} from 'react-native';
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
import useTrialProGuard from '../../hooks/useTrialProGuard';
import TrialProUnlockPanel from '../../components/TrialProUnlockPanel';
import { TRIAL_PRO_FEATURE_KEYS } from '../../utils/trialProFeatures';

const fmtIsoDate = (d) => {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

const displayDate = (iso) => {
  const s = fmtIsoDate(iso);
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

export default function AdminMembershipFreezeScreen() {
  const navigation = useNavigation();
  const hideInlineBack = useStaffWebHideInlineBack();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { organization, refreshOrganization } = useAuth();
  const { proLocked } = useTrialProGuard();

  const orgId = organization?.id;
  const freezeEnabled = !!organization?.membership_freeze_enabled;

  const [loading, setLoading] = useState(true);
  const [frozenRows, setFrozenRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pickUser, setPickUser] = useState(null);
  const [pickSubs, setPickSubs] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [freezeStart, setFreezeStart] = useState('');
  const [freezeEnd, setFreezeEnd] = useState('');
  const [busyId, setBusyId] = useState(null);

  const loadFrozen = useCallback(async () => {
    if (!orgId) {
      setFrozenRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('staff_list_frozen_user_abonos', { p_org_id: orgId });
      if (error) throw error;
      setFrozenRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setFrozenRows([]);
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [orgId, tStr]);

  const loadClients = useCallback(async () => {
    if (!orgId) {
      setClients([]);
      return;
    }
    setClientsLoading(true);
    try {
      const { data: mems, error: e1 } = await supabase
        .from('organization_memberships')
        .select('user_id, role, active')
        .eq('organization_id', orgId)
        .eq('active', true);
      if (e1) throw e1;
      const ids = (mems || [])
        .filter((m) => String(m?.role || '').toLowerCase() === 'cliente' && m?.user_id)
        .map((m) => m.user_id);
      const uniq = [...new Set(ids)];
      if (uniq.length === 0) {
        setClients([]);
        return;
      }
      const { data: profs, error: e2 } = await supabase.from('profiles').select('id, full_name, username').in('id', uniq);
      if (e2) throw e2;
      const list = (profs || []).map((p) => ({
        id: p.id,
        label: (p.full_name || p.username || p.id || '').trim() || String(p.id),
      }));
      list.sort((a, b) => a.label.localeCompare(b.label, 'es'));
      setClients(list);
    } catch (e) {
      setClients([]);
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
    } finally {
      setClientsLoading(false);
    }
  }, [orgId, tStr]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        if (typeof refreshOrganization === 'function' && orgId) {
          await refreshOrganization(orgId);
        }
        if (!alive) return;
        await loadFrozen();
        if (!alive) return;
        await loadClients();
      })();
      return () => {
        alive = false;
      };
    }, [orgId, loadFrozen, loadClients, refreshOrganization]),
  );

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.label.toLowerCase().includes(q));
  }, [clients, search]);

  const openFreezeWizard = useCallback(() => {
    if (!freezeEnabled) {
      Alert.alert(tStr('admin_freeze_disabled_title'), tStr('admin_freeze_disabled_body'));
      return;
    }
    setPickUser(null);
    setPickSubs([]);
    setFreezeStart('');
    setFreezeEnd('');
    setSearch('');
    setModalOpen(true);
  }, [freezeEnabled, tStr]);

  const loadSubsForUser = useCallback(
    async (userId) => {
      setSubsLoading(true);
      setPickSubs([]);
      try {
        const { data, error } = await supabase
          .from('user_abonos')
          .select('id, plan_id, status, start_date, end_date, abonos(name)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(30);
        if (error) throw error;
        const rows = (data || []).filter((r) => String(r?.status || '').toLowerCase() === 'active');
        setPickSubs(rows);
      } catch (e) {
        Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
      } finally {
        setSubsLoading(false);
      }
    },
    [tStr],
  );

  const onPickClient = useCallback(
    async (c) => {
      setPickUser(c);
      await loadSubsForUser(c.id);
    },
    [loadSubsForUser],
  );

  const runFreeze = useCallback(
    async (userAbonoId) => {
      const start = fmtIsoDate(freezeStart);
      const end = fmtIsoDate(freezeEnd);
      if (!start || !end) {
        Alert.alert(tStr('admin_freeze_dates_title'), tStr('admin_freeze_dates_body'));
        return;
      }
      setBusyId(userAbonoId);
      try {
        const { data, error } = await supabase.rpc('staff_freeze_user_abono', {
          p_user_abono_id: userAbonoId,
          p_freeze_start: start,
          p_freeze_end: end,
        });
        if (error) throw error;
        const payload = Array.isArray(data) ? data[0] : data;
        if (!payload?.ok) {
          const r = payload?.reason || 'error';
          const rk = `admin_freeze_reason_${r}`;
          const msg = tStr(rk);
          Alert.alert(tStr('admin_freeze_error_title'), msg === rk ? String(r) : msg);
          return;
        }
        setModalOpen(false);
        setPickUser(null);
        await loadFrozen();
        Alert.alert(tStr('admin_freeze_done_title'), tStr('admin_freeze_done_body'));
      } catch (e) {
        Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
      } finally {
        setBusyId(null);
      }
    },
    [freezeEnd, freezeStart, loadFrozen, tStr],
  );

  const runUnfreeze = useCallback(
    async (userAbonoId) => {
      Alert.alert(tStr('admin_unfreeze_confirm_title'), tStr('admin_unfreeze_confirm_body'), [
        { text: tStr('admin_freeze_cancel'), style: 'cancel' },
        {
          text: tStr('admin_unfreeze_cta'),
          style: 'default',
          onPress: async () => {
            setBusyId(userAbonoId);
            try {
              const { data, error } = await supabase.rpc('staff_unfreeze_user_abono', {
                p_user_abono_id: userAbonoId,
              });
              if (error) throw error;
              const payload = Array.isArray(data) ? data[0] : data;
              if (!payload?.ok) {
                const r = payload?.reason || 'error';
                const rk = `admin_freeze_reason_${r}`;
                const msg = tStr(rk);
                Alert.alert(tStr('admin_freeze_error_title'), msg === rk ? String(r) : msg);
                return;
              }
              await loadFrozen();
              Alert.alert(tStr('admin_unfreeze_done_title'), tStr('admin_unfreeze_done_body'));
            } catch (e) {
              Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
            } finally {
              setBusyId(null);
            }
          },
        },
      ]);
    },
    [loadFrozen, tStr],
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
        backBtn: { marginRight: 8, width: 'auto', maxWidth: 180, alignSelf: 'flex-start' },
        title: { flex: 1, color: t.text, fontSize: MOBILE_TYPE.headline, fontWeight: '900' },
        scroll: { flex: 1 },
        scrollInner: {
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingBottom: 32,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        hint: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginBottom: 12, lineHeight: 18 },
        card: {
          backgroundColor: t.boxBg,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          padding: 14,
          marginBottom: 10,
        },
        rowTitle: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800' },
        rowSub: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 4 },
        primaryBtn: {
          marginTop: 12,
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: MOBILE_RADII.pill,
          ...t.buttonPrimary,
        },
        primaryBtnText: { ...t.buttonPrimaryText, fontWeight: '800', marginLeft: 8 },
        ghostBtn: {
          marginTop: 8,
          paddingVertical: 8,
          paddingHorizontal: MOBILE_SPACING.md,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          alignSelf: 'flex-start',
        },
        ghostBtnText: { color: t.brand, fontWeight: '700', fontSize: MOBILE_TYPE.body },
        input: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          paddingHorizontal: MOBILE_SPACING.md,
          paddingVertical: Platform.OS === 'ios' ? 10 : 8,
          color: t.text,
          backgroundColor: t.inputBg,
          marginTop: 8,
        },
        modalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          padding: MOBILE_SPACING.xl,
        },
        modalCard: {
          backgroundColor: t.boxBg,
          borderRadius: MOBILE_RADII.lg,
          padding: MOBILE_SPACING.lg,
          maxHeight: '88%',
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        modalTitle: { color: t.text, fontSize: MOBILE_TYPE.headline, fontWeight: '900', marginBottom: 8 },
      }),
    [insets.top, t],
  );

  return (
    <ScreenShell
      screen="Admin"
      scroll
      scrollProps={{
        style: styles.scroll,
        contentContainerStyle: styles.scrollInner,
      }}
      companion={
        <Modal visible={modalOpen} animationType="fade" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{tStr('admin_freeze_modal_title')}</Text>
            {!pickUser ? (
              <>
                <Text style={styles.rowSub}>{tStr('admin_freeze_search_label')}</Text>
                <TextInput
                  style={styles.input}
                  value={search}
                  onChangeText={setSearch}
                  placeholder={tStr('admin_freeze_search_ph')}
                  placeholderTextColor={t.placeholder}
                  autoCorrect={false}
                />
                {clientsLoading ? (
                  <ActivityIndicator style={{ marginTop: 16 }} color={t.brand} />
                ) : (
                  <FlatList
                    style={{ marginTop: 12, maxHeight: 280 }}
                    data={filteredClients}
                    keyExtractor={(c) => c.id}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity style={{ paddingVertical: 10 }} onPress={() => onPickClient(item)}>
                        <Text style={styles.rowTitle}>{item.label}</Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={styles.rowSub}>{tStr('admin_freeze_no_clients')}</Text>}
                  />
                )}
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => setPickUser(null)} style={{ marginBottom: 8 }}>
                  <Text style={{ color: t.brand, fontWeight: '700' }}>{tStr('admin_freeze_back_pick')}</Text>
                </TouchableOpacity>
                <Text style={styles.rowTitle}>{pickUser.label}</Text>
                <Text style={[styles.rowSub, { marginTop: 8 }]}>{tStr('admin_freeze_dates_label')}</Text>
                <TextInput
                  style={styles.input}
                  value={freezeStart}
                  onChangeText={setFreezeStart}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={t.placeholder}
                />
                <TextInput
                  style={styles.input}
                  value={freezeEnd}
                  onChangeText={setFreezeEnd}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={t.placeholder}
                />
                {subsLoading ? (
                  <ActivityIndicator style={{ marginTop: 16 }} color={t.brand} />
                ) : (
                  <FlatList
                    style={{ marginTop: 12, maxHeight: 220 }}
                    data={pickSubs}
                    keyExtractor={(r) => String(r.id)}
                    ListEmptyComponent={<Text style={styles.rowSub}>{tStr('admin_freeze_no_active_sub')}</Text>}
                    renderItem={({ item }) => {
                      const busy = busyId === item.id;
                      return (
                        <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.overlayBorder }}>
                          <Text style={styles.rowTitle}>
                            {(item.abonos && item.abonos.name) || item.plan_id} · {String(item.status)}
                          </Text>
                          <TouchableOpacity
                            style={[styles.primaryBtn, { marginTop: 8 }]}
                            onPress={() => runFreeze(item.id)}
                            disabled={busy}
                          >
                            {busy ? (
                              <ActivityIndicator color={t.text} />
                            ) : (
                              <Text style={styles.primaryBtnText}>{tStr('admin_freeze_apply_cta')}</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    }}
                  />
                )}
              </>
            )}
            <TouchableOpacity style={[styles.ghostBtn, { marginTop: 16, alignSelf: 'stretch' }]} onPress={() => setModalOpen(false)}>
              <Text style={[styles.ghostBtnText, { textAlign: 'center' }]}>{tStr('admin_freeze_cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </Modal>
      }
    >
      <View style={styles.header}>
        {!hideInlineBack ? (
          <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} style={styles.backBtn} />
        ) : null}
        <Text style={styles.title}>{tStr('admin_freeze_screen_title')}</Text>
      </View>

      {proLocked ? (
        <TrialProUnlockPanel featureKey={TRIAL_PRO_FEATURE_KEYS.MEMBERSHIP_FREEZE} />
      ) : (
        <>
      <Text style={styles.hint}>{tStr('admin_freeze_screen_hint')}</Text>

      {!freezeEnabled ? (
        <View style={styles.card}>
          <Text style={styles.rowTitle}>{tStr('admin_freeze_disabled_title')}</Text>
          <Text style={styles.rowSub}>{tStr('admin_freeze_disabled_hint')}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.primaryBtn} onPress={openFreezeWizard} activeOpacity={0.9}>
        <Ionicons name="snow-outline" size={18} color={t.text} />
        <Text style={styles.primaryBtnText}>{tStr('admin_freeze_new_cta')}</Text>
      </TouchableOpacity>

      <Text style={[styles.rowTitle, { marginTop: 20, marginBottom: 8 }]}>{tStr('admin_freeze_list_title')}</Text>
      {loading ? (
        <ActivityIndicator color={t.brand} />
      ) : frozenRows.length === 0 ? (
        <Text style={styles.rowSub}>{tStr('admin_freeze_list_empty')}</Text>
      ) : (
        frozenRows.map((item) => {
          const id = item.user_abono_id;
          const busy = busyId === id;
          return (
            <View key={String(id)} style={styles.card}>
              <Text style={styles.rowTitle}>{item.display_name || item.user_id}</Text>
              <Text style={styles.rowSub}>
                {item.abono_name || item.plan_id} · {displayDate(item.freeze_start)} → {displayDate(item.freeze_end)}
              </Text>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() => runUnfreeze(id)}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={t.brand} />
                ) : (
                  <Text style={styles.ghostBtnText}>{tStr('admin_unfreeze_cta')}</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })
      )}
        </>
      )}
    </ScreenShell>
  );
}
