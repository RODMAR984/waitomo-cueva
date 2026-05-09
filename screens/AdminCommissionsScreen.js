// 5.4 — Comisiones coach × plan (basis points).

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import useStaffWebHideInlineBack from '../hooks/useStaffWebHideInlineBack';
import { WEB_CONTENT_MAX_WIDTH, WEB_PANEL_RADIUS } from '../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';

export default function AdminCommissionsScreen() {
  const navigation = useNavigation();
  const hideInlineBack = useStaffWebHideInlineBack();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { organization, profile } = useAuth() || {};
  const orgId = organization?.id ?? profile?.organization_id ?? null;

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [rows, setRows] = useState([]);
  const [coachId, setCoachId] = useState('');
  const [planKey, setPlanKey] = useState('');
  const [bps, setBps] = useState('0');
  const [manualPlan, setManualPlan] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) {
      setPlans([]);
      setCoaches([]);
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [pRes, mRes, cRes] = await Promise.all([
        supabase.from('plans').select('code, title').eq('organization_id', orgId).order('order'),
        supabase.from('organization_memberships').select('user_id, role, active').eq('organization_id', orgId).eq('active', true),
        supabase.from('coach_plan_commissions').select('id, coach_user_id, plan_key, commission_bps').eq('organization_id', orgId),
      ]);
      if (pRes.error) throw pRes.error;
      if (mRes.error) throw mRes.error;
      if (cRes.error) throw cRes.error;
      setPlans(Array.isArray(pRes.data) ? pRes.data : []);
      const staffRoles = new Set(['owner', 'admin', 'coach', 'superadmin']);
      const ids = (mRes.data || []).filter((x) => staffRoles.has(String(x.role || '').toLowerCase())).map((x) => x.user_id);
      const uniq = [...new Set(ids)];
      let coachRows = [];
      if (uniq.length) {
        const { data: profs, error: pe } = await supabase.from('profiles').select('id, full_name, username').in('id', uniq);
        if (pe) throw pe;
        coachRows = (profs || []).map((p) => ({
          id: p.id,
          label: (p.full_name || p.username || p.id).trim(),
        }));
      }
      coachRows.sort((a, b) => a.label.localeCompare(b.label, 'es'));
      setCoaches(coachRows);
      setRows(Array.isArray(cRes.data) ? cRes.data : []);
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [orgId, tStr]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const saveRow = async () => {
    const pk = (manualPlan.trim() || planKey.trim()).toLowerCase();
    if (!orgId || !coachId || !pk) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('admin_commissions_need_fields'));
      return;
    }
    const n = parseInt(String(bps || '0').trim(), 10);
    if (!Number.isFinite(n) || n < 0 || n > 10000) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('admin_commissions_bps_invalid'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('coach_plan_commissions').upsert(
        {
          organization_id: orgId,
          coach_user_id: coachId,
          plan_key: pk,
          commission_bps: n,
        },
        { onConflict: 'organization_id,coach_user_id,plan_key' },
      );
      if (error) throw error;
      setBps('0');
      setManualPlan('');
      await load();
      Alert.alert(tStr('gym_config_saved_title'), tStr('gym_config_saved_body'));
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (id) => {
    const { error } = await supabase.from('coach_plan_commissions').delete().eq('id', id);
    if (error) Alert.alert(tStr('gym_config_alert_title_error'), error.message);
    else load();
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: Platform.OS === 'web' ? MOBILE_SPACING.lg : 8 + insets.top,
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingBottom: 8,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        backBtn: { padding: 8, marginRight: 4 },
        title: { flex: 1, color: t.text, fontSize: 18, fontWeight: '900' },
        body: { paddingHorizontal: MOBILE_SPACING.lg, paddingBottom: 32, width: '100%', maxWidth: WEB_CONTENT_MAX_WIDTH, alignSelf: 'center' },
        hint: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginBottom: 12, lineHeight: 18 },
        label: { color: t.subText, fontSize: 11, marginTop: 8 },
        input: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          padding: 10,
          color: t.text,
          backgroundColor: t.inputBg,
          marginTop: 4,
        },
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
        chip: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: MOBILE_RADII.pill,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        chipOn: { borderColor: t.brand, backgroundColor: `${t.brand}22` },
        chipText: { color: t.text, fontSize: MOBILE_TYPE.caption, fontWeight: '700' },
        btn: { marginTop: 14, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: MOBILE_SPACING.lg, borderRadius: MOBILE_RADII.md, ...t.buttonPrimary },
        btnText: { ...t.buttonPrimaryText, fontWeight: '800' },
        card: {
          padding: 12,
          borderRadius: WEB_PANEL_RADIUS,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          marginTop: 10,
          backgroundColor: t.boxBg,
        },
        listLabel: { marginTop: 20 },
        rowTitle: { color: t.text, fontWeight: '800' },
        rowSub: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 4 },
        deleteWrap: { marginTop: 8 },
        deleteText: { color: t.danger, fontWeight: '700' },
        btnBusy: { opacity: 0.7 },
      }),
    [insets.top, t],
  );

  return (
    <BackgroundWrapper screen="Admin">
      <View style={styles.header}>
        {!hideInlineBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={24} color={t.text} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title}>{tStr('admin_commissions_title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hint}>{tStr('admin_commissions_hint')}</Text>
        {loading ? (
          <ActivityIndicator color={t.brand} />
        ) : (
          <>
            <Text style={styles.label}>{tStr('admin_commissions_coach')}</Text>
            <View style={styles.chipRow}>
              {coaches.map((c) => (
                <TouchableOpacity key={c.id} style={[styles.chip, coachId === c.id && styles.chipOn]} onPress={() => setCoachId(c.id)}>
                  <Text style={styles.chipText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>{tStr('admin_commissions_plan')}</Text>
            <View style={styles.chipRow}>
              {plans.map((p) => (
                <TouchableOpacity
                  key={p.code}
                  style={[styles.chip, planKey === p.code && styles.chipOn]}
                  onPress={() => {
                    setPlanKey(p.code);
                    setManualPlan('');
                  }}
                >
                  <Text style={styles.chipText}>{p.title || p.code}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>{tStr('admin_commissions_plan_manual')}</Text>
            <TextInput
              style={styles.input}
              value={manualPlan}
              onChangeText={setManualPlan}
              placeholder={tStr('admin_commissions_plan_manual_ph')}
              placeholderTextColor={t.placeholder}
              autoCapitalize="none"
            />
            <Text style={styles.label}>{tStr('admin_commissions_bps')}</Text>
            <TextInput style={styles.input} value={bps} onChangeText={setBps} keyboardType="number-pad" placeholder="0–10000" />
            <TouchableOpacity style={[styles.btn, saving && styles.btnBusy]} onPress={saveRow} disabled={saving}>
              <Text style={styles.btnText}>{tStr('admin_commissions_save')}</Text>
            </TouchableOpacity>
            <Text style={[styles.label, styles.listLabel]}>{tStr('admin_commissions_list')}</Text>
            {rows.map((r) => (
              <View key={r.id} style={styles.card}>
                <Text style={styles.rowTitle}>
                  {r.plan_key} · {(r.commission_bps / 100).toFixed(2)}%
                </Text>
                <Text style={styles.rowSub}>{r.coach_user_id}</Text>
                <TouchableOpacity onPress={() => deleteRow(r.id)} style={styles.deleteWrap}>
                  <Text style={styles.deleteText}>{tStr('admin_commissions_delete')}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </BackgroundWrapper>
  );
}
