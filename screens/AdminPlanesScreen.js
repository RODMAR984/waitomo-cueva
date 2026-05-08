// AdminPlanesScreen — CRUD de planes por organización + política de asistencia + grilla semanal (Fase 1).

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import BackgroundWrapper from '../components/BackgroundWrapper';
import BackNavButton from '../components/BackNavButton';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { supabase } from '../supabaseClient';
import useStaffWebHideInlineBack from '../hooks/useStaffWebHideInlineBack';
import { normalizeSlotLabel } from '../utils/freeClassGrantStorage';
import {
  WEB_CONTENT_MAX_WIDTH,
  WEB_DESKTOP_BREAKPOINT,
  WEB_PANEL_RADIUS,
} from '../theme/webSpec';

const hexToRgba = (hex, alpha) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

function attendanceLabel(tStr, policy) {
  const p = String(policy || 'dropin');
  if (p === 'booking_required') return tStr('admin_plans_att_booking');
  if (p === 'dropin_capped') return tStr('admin_plans_att_dropin_capped');
  if (p === 'not_applicable') return tStr('admin_plans_att_na');
  return tStr('admin_plans_att_dropin');
}

function dowLabel(tStr, weekday) {
  const k = `admin_plans_dow_${Number(weekday)}`;
  return tStr(k);
}

function findSlotConflicts(localSlots, excludePlanCode, allSlotRows, plansList) {
  const titleByCode = {};
  (plansList || []).forEach((p) => {
    titleByCode[p.code] = p.title || p.code;
  });
  const others = excludePlanCode
    ? (allSlotRows || []).filter((r) => r.plan_code !== excludePlanCode)
    : allSlotRows || [];
  const seen = new Set();
  const out = [];
  for (const s of localSlots) {
    const w = Number(s.weekday);
    const slot = normalizeSlotLabel(s.slot_label);
    if (!slot || w < 1 || w > 7) continue;
    const key = `${w}|${slot}`;
    if (seen.has(key)) {
      out.push({ weekday: w, slot, otherTitle: '—', dup: true });
      continue;
    }
    seen.add(key);
    for (const o of others) {
      if (Number(o.weekday) !== w) continue;
      if (normalizeSlotLabel(o.slot_label) !== slot) continue;
      out.push({ weekday: w, slot, otherTitle: titleByCode[o.plan_code] || o.plan_code, dup: false });
    }
  }
  return out;
}

export default function AdminPlanesScreen() {
  const navigation = useNavigation();
  const hideInlineBack = useStaffWebHideInlineBack();
  const { width } = useWindowDimensions();
  const isWebWide = Platform.OS === 'web' && width >= WEB_DESKTOP_BREAKPOINT;
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const MODES = useMemo(
    () => [
      { label: tStr('admin_plans_mode_class'), value: 'class' },
      { label: tStr('admin_plans_mode_program'), value: 'program' },
    ],
    [tStr],
  );
  const ATT_OPTS = useMemo(
    () => [
      { label: tStr('admin_plans_att_booking'), value: 'booking_required' },
      { label: tStr('admin_plans_att_dropin'), value: 'dropin' },
      { label: tStr('admin_plans_att_dropin_capped'), value: 'dropin_capped' },
    ],
    [tStr],
  );
  const { profile, organization } = useAuth() || {};
  const orgId = organization?.id || profile?.organization_id;

  const [plans, setPlans] = useState([]);
  const [allSlotRows, setAllSlotRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formMode, setFormMode] = useState('class');
  const [formOrder, setFormOrder] = useState('0');
  const [formAttendance, setFormAttendance] = useState('dropin');
  const [formCapacity, setFormCapacity] = useState('');
  const [formNearFullThreshold, setFormNearFullThreshold] = useState('2');
  const [formCancelNoticeHours, setFormCancelNoticeHours] = useState('2');
  const [formLocalSlots, setFormLocalSlots] = useState([]);

  const isOwner = organization?.owner_id === profile?.id;

  const loadPlans = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('id, code, title, subtitle, mode, active, order, attendance_policy, default_capacity, near_full_threshold, cancel_notice_hours')
        .eq('organization_id', orgId)
        .order('order', { ascending: true });
      if (error) throw error;
      setPlans(Array.isArray(data) ? data : []);

      const { data: sl, error: e2 } = await supabase
        .from('plan_week_slots')
        .select('id, plan_code, weekday, slot_label')
        .eq('organization_id', orgId);
      if (e2) throw e2;
      setAllSlotRows(Array.isArray(sl) ? sl : []);
    } catch (e) {
      console.log('AdminPlanes load:', e?.message || e);
      setPlans([]);
      setAllSlotRows([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const openEdit = (row) => {
    setEditingId(row.id);
    setFormCode(row.code || '');
    setFormTitle(row.title || '');
    setFormSubtitle(row.subtitle || '');
    setFormMode(row.mode || 'class');
    setFormOrder(String(row.order ?? 0));
    const ap = row.attendance_policy || (row.mode === 'program' ? 'not_applicable' : 'dropin');
    setFormAttendance(row.mode === 'program' ? 'not_applicable' : ap === 'not_applicable' ? 'dropin' : ap);
    setFormCapacity(row.default_capacity != null ? String(row.default_capacity) : '');
    setFormNearFullThreshold(row.near_full_threshold != null ? String(row.near_full_threshold) : '2');
    setFormCancelNoticeHours(row.cancel_notice_hours != null ? String(row.cancel_notice_hours) : '2');
    const mine = (allSlotRows || []).filter((s) => s.plan_code === row.code);
    setFormLocalSlots(mine.map((s) => ({ id: s.id, weekday: s.weekday, slot_label: s.slot_label })));
    setShowNew(false);
  };

  const openNew = () => {
    setEditingId(null);
    setFormCode('');
    setFormTitle('');
    setFormSubtitle('');
    setFormMode('class');
    setFormOrder(String((plans.length || 0) + 1));
    setFormAttendance('dropin');
    setFormCapacity('');
    setFormNearFullThreshold('2');
    setFormCancelNoticeHours('2');
    setFormLocalSlots([]);
    setShowNew(true);
  };

  const cancelForm = () => {
    setEditingId(null);
    setShowNew(false);
    setFormLocalSlots([]);
  };

  const replaceSlotsForPlan = async (planCode, slots) => {
    const { error: delErr } = await supabase
      .from('plan_week_slots')
      .delete()
      .eq('organization_id', orgId)
      .eq('plan_code', planCode);
    if (delErr) throw delErr;
    if (!slots.length) return;
    const rows = slots.map((s) => ({
      organization_id: orgId,
      plan_code: planCode,
      weekday: Number(s.weekday),
      slot_label: normalizeSlotLabel(s.slot_label),
    }));
    const { error: insErr } = await supabase.from('plan_week_slots').insert(rows);
    if (insErr) throw insErr;
  };

  const savePlan = async () => {
    const code = (formCode || '').trim().toLowerCase().replace(/\s+/g, '_');
    const title = (formTitle || '').trim();
    if (!code || !title) {
      Alert.alert(tStr('admin_plans_alert_data_title'), tStr('admin_plans_alert_data_body'));
      return;
    }
    if (!orgId || !isOwner) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('admin_plans_no_permission'));
      return;
    }

    const isProgram = formMode === 'program';
    const attendance = isProgram ? 'not_applicable' : formAttendance;
    const capRaw = (formCapacity || '').trim();
    const capNum = capRaw ? parseInt(capRaw, 10) : null;
    const nearRaw = (formNearFullThreshold || '').trim();
    const nearNum = nearRaw ? parseInt(nearRaw, 10) : 2;
    const cancelRaw = (formCancelNoticeHours || '').trim();
    const cancelNum = cancelRaw ? parseInt(cancelRaw, 10) : 2;
    if (
      !isProgram &&
      (attendance === 'booking_required' || attendance === 'dropin_capped') &&
      (!Number.isFinite(capNum) || capNum < 1)
    ) {
      Alert.alert(tStr('admin_plans_alert_data_title'), tStr('admin_plans_capacity_required'));
      return;
    }
    const defaultCapacity =
      isProgram || attendance === 'dropin' ? null : Number.isFinite(capNum) && capNum > 0 ? capNum : null;
    const nearFullThreshold =
      isProgram || attendance === 'dropin'
        ? null
        : Number.isFinite(nearNum) && nearNum >= 1
          ? Math.min(nearNum, 20)
          : 2;
    const cancelNoticeHours =
      isProgram || attendance === 'dropin'
        ? null
        : Number.isFinite(cancelNum) && cancelNum >= 0
          ? Math.min(cancelNum, 72)
          : 2;

    const slotsToSave = isProgram
      ? []
      : formLocalSlots
          .map((s) => ({
            weekday: Number(s.weekday),
            slot_label: normalizeSlotLabel(s.slot_label),
          }))
          .filter((s) => s.weekday >= 1 && s.weekday <= 7 && s.slot_label);

    const conflicts = findSlotConflicts(
      slotsToSave.map((s) => ({ weekday: s.weekday, slot_label: s.slot_label })),
      editingId ? code : null,
      allSlotRows,
      plans,
    );
    if (conflicts.length) {
      const c0 = conflicts[0];
      const when = `${dowLabel(tStr, c0.weekday)} ${c0.slot}`;
      if (c0.dup) {
        Alert.alert(tStr('gym_config_alert_title_error'), tStr('admin_plans_dup_same_plan'));
        return;
      }
      Alert.alert(
        tStr('gym_config_alert_title_error'),
        tStr('admin_plans_conflict_save_blocked').replace('{{other}}', c0.otherTitle).replace('{{when}}', when),
      );
      return;
    }

    setSaving(true);
    try {
      const orderNum = parseInt(formOrder, 10) || 0;
      const payload = {
        code,
        title,
        subtitle: (formSubtitle || '').trim() || null,
        mode: formMode,
        order: orderNum,
        attendance_policy: attendance,
        default_capacity: defaultCapacity,
        near_full_threshold: nearFullThreshold,
        cancel_notice_hours: cancelNoticeHours,
      };

      if (editingId) {
        const { error } = await supabase.from('plans').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('plans')
          .insert({
            organization_id: orgId,
            ...payload,
            active: true,
          });
        if (error) throw error;
      }

      await replaceSlotsForPlan(code, slotsToSave);
      cancelForm();
      await loadPlans();
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('admin_crud_save_fail'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      const { error } = await supabase.from('plans').update({ active: !row.active }).eq('id', row.id);
      if (error) throw error;
      await loadPlans();
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('admin_crud_update_fail'));
    }
  };

  const addLocalSlot = () => {
    setFormLocalSlots((prev) => [...prev, { tempKey: `t${Date.now()}`, weekday: 1, slot_label: '08:00' }]);
  };

  const removeLocalSlot = (row) => {
    const key = row.id || row.tempKey;
    setFormLocalSlots((prev) => prev.filter((x) => (x.id || x.tempKey) !== key));
  };

  const patchLocalSlot = (row, patch) => {
    const key = row.id || row.tempKey;
    setFormLocalSlots((prev) => prev.map((x) => ((x.id || x.tempKey) === key ? { ...x, ...patch } : x)));
  };

  const formVisible = !!(showNew || editingId);
  const isDesktopSplit = isWebWide && formVisible && isOwner;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          padding: 20,
          paddingTop: 56,
          width: '100%',
          alignSelf: 'center',
          maxWidth: Platform.OS === 'web' ? WEB_CONTENT_MAX_WIDTH : undefined,
        },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
        backBtn: { marginLeft: 0, width: 'auto', maxWidth: 180, alignSelf: 'flex-start' },
        title: { color: t.text, fontSize: 22, fontWeight: '800' },
        btn: { ...t.buttonPrimary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
        btnText: { ...t.buttonPrimaryText, fontSize: 14 },
        list: { paddingBottom: 40 },
        formListGrid: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          columnGap: 14,
        },
        formCol: {
          flex: 0.95,
          minWidth: 0,
        },
        listCol: {
          flex: 1.25,
          minWidth: 0,
        },
        cardsGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 10,
        },
        card: {
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: WEB_PANEL_RADIUS,
          padding: 14,
          marginBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: isDesktopSplit ? '100%' : isWebWide ? '49.2%' : '100%',
        },
        cardLeft: { flex: 1 },
        cardTitle: { color: t.text, fontSize: 15, fontWeight: '600' },
        cardMeta: { color: t.subText, fontSize: 12, marginTop: 4 },
        formWrap: {
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: WEB_PANEL_RADIUS,
          padding: 16,
          marginBottom: 16,
        },
        label: { color: t.subText, fontSize: 13, marginBottom: 6, fontWeight: '600' },
        input: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          padding: 12,
          color: t.text,
          backgroundColor: t.inputBg,
          marginBottom: 12,
          fontSize: 15,
        },
        row: { flexDirection: 'row', gap: 10, marginTop: 8 },
        empty: { paddingVertical: 40, alignItems: 'center' },
        emptyText: { color: t.placeholder, fontSize: 16 },
        segRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
        segBtn: {
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.inputBg,
        },
        segBtnOn: { borderColor: t.brand, backgroundColor: hexToRgba(t.brand, 0.12) },
        segBtnTxt: { color: t.text, fontSize: 13, fontWeight: '600' },
        segBtnTxtOn: { color: t.brand },
        hint: { color: t.placeholder, fontSize: 12, lineHeight: 17, marginBottom: 10 },
        previewPill: {
          alignSelf: 'flex-start',
          borderWidth: 1,
          borderColor: hexToRgba('#d97706', 0.32),
          backgroundColor: hexToRgba('#f59e0b', 0.14),
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 5,
          marginBottom: 10,
        },
        previewPillTxt: { color: '#92400e', fontSize: 12, fontWeight: '700' },
        slotCard: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          padding: 10,
          marginBottom: 8,
          backgroundColor: t.inputBg,
        },
        dowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
        dowChip: {
          paddingVertical: 6,
          paddingHorizontal: 8,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        dowChipOn: { borderColor: t.brand, backgroundColor: hexToRgba(t.brand, 0.1) },
        dowChipTxt: { color: t.subText, fontSize: 12, fontWeight: '700' },
        dowChipTxtOn: { color: t.brand },
        slotRowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        smallBtn: { padding: 6 },
        addSlotBtn: {
          alignSelf: 'flex-start',
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: t.brand,
          marginTop: 4,
          marginBottom: 8,
        },
        addSlotTxt: { color: t.brand, fontWeight: '700', fontSize: 14 },
      }),
    [t, width, isWebWide, isDesktopSplit],
  );

  return (
    <BackgroundWrapper screen="admin">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.screen} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            {!hideInlineBack ? (
              <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} style={styles.backBtn} />
            ) : null}
            <Text style={styles.title}>{tStr('admin_plans_screen_title')}</Text>
            {isOwner && (
              <TouchableOpacity style={styles.btn} onPress={openNew} activeOpacity={0.9}>
                <Text style={styles.btnText}>{tStr('admin_plans_new')}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={isDesktopSplit ? styles.formListGrid : null}>
            <View style={isDesktopSplit ? styles.formCol : null}>
              {formVisible && isOwner && (
                <View style={styles.formWrap}>
              <Text style={styles.label}>{tStr('admin_plans_label_code')}</Text>
              <TextInput
                style={styles.input}
                value={formCode}
                onChangeText={setFormCode}
                placeholder={tStr('admin_plans_ph_code')}
                placeholderTextColor={t.placeholder}
                editable={!editingId}
              />
              <Text style={styles.label}>{tStr('admin_plans_label_title')}</Text>
              <TextInput
                style={styles.input}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder={tStr('admin_plans_ph_title')}
                placeholderTextColor={t.placeholder}
              />
              <Text style={styles.label}>{tStr('admin_plans_label_sub')}</Text>
              <TextInput
                style={styles.input}
                value={formSubtitle}
                onChangeText={setFormSubtitle}
                placeholder={tStr('admin_plans_ph_sub')}
                placeholderTextColor={t.placeholder}
              />
              <Text style={styles.label}>{tStr('admin_plans_label_order')}</Text>
              <TextInput
                style={styles.input}
                value={formOrder}
                onChangeText={setFormOrder}
                placeholder={tStr('admin_plans_ph_order')}
                placeholderTextColor={t.placeholder}
                keyboardType="number-pad"
              />

              <Text style={styles.label}>{tStr('admin_plans_mode_class')} / {tStr('admin_plans_mode_program')}</Text>
              <View style={styles.segRow}>
                {MODES.map((m) => {
                  const on = formMode === m.value;
                  return (
                    <TouchableOpacity
                      key={m.value}
                      style={[styles.segBtn, on && styles.segBtnOn]}
                      onPress={() => {
                        setFormMode(m.value);
                        if (m.value === 'program') {
                          setFormAttendance('not_applicable');
                          setFormCapacity('');
                          setFormNearFullThreshold('2');
                          setFormLocalSlots([]);
                        } else if (formAttendance === 'not_applicable') {
                          setFormAttendance('dropin');
                        }
                      }}
                    >
                      <Text style={[styles.segBtnTxt, on && styles.segBtnTxtOn]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {formMode === 'class' ? (
                <>
                  <Text style={styles.label}>{tStr('admin_plans_label_attendance')}</Text>
                  <View style={styles.segRow}>
                    {ATT_OPTS.map((a) => {
                      const on = formAttendance === a.value;
                      return (
                        <TouchableOpacity
                          key={a.value}
                          style={[styles.segBtn, on && styles.segBtnOn]}
                          onPress={() => setFormAttendance(a.value)}
                        >
                          <Text style={[styles.segBtnTxt, on && styles.segBtnTxtOn]} numberOfLines={2}>
                            {a.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {(formAttendance === 'booking_required' || formAttendance === 'dropin_capped') && (
                    <>
                      <Text style={styles.label}>{tStr('admin_plans_label_default_capacity')}</Text>
                      <TextInput
                        style={styles.input}
                        value={formCapacity}
                        onChangeText={setFormCapacity}
                        placeholder={tStr('admin_plans_ph_capacity')}
                        placeholderTextColor={t.placeholder}
                        keyboardType="number-pad"
                      />
                      <Text style={styles.label}>{tStr('admin_plans_label_near_full_threshold')}</Text>
                      <TextInput
                        style={styles.input}
                        value={formNearFullThreshold}
                        onChangeText={setFormNearFullThreshold}
                        placeholder={tStr('admin_plans_ph_near_full_threshold')}
                        placeholderTextColor={t.placeholder}
                        keyboardType="number-pad"
                      />
                      <Text style={styles.hint}>
                        {tStr('admin_plans_hint_near_full_threshold').replace(
                          '{{n}}',
                          String(Math.max(1, parseInt(formNearFullThreshold || '2', 10) || 2)),
                        )}
                      </Text>
                      <View style={styles.previewPill}>
                        <Text style={styles.previewPillTxt}>
                          {tStr('admin_plans_preview_near_full')
                            .replace('{{occ}}', String(Math.max(0, (parseInt(formCapacity || '10', 10) || 10) - Math.max(1, parseInt(formNearFullThreshold || '2', 10) || 2))))
                            .replace('{{cap}}', String(parseInt(formCapacity || '10', 10) || 10))
                            .replace('{{label}}', tStr('calendario_state_near_full'))}
                        </Text>
                      </View>
                      <Text style={styles.label}>{tStr('admin_plans_label_cancel_notice')}</Text>
                      <TextInput
                        style={styles.input}
                        value={formCancelNoticeHours}
                        onChangeText={setFormCancelNoticeHours}
                        placeholder={tStr('admin_plans_ph_cancel_notice')}
                        placeholderTextColor={t.placeholder}
                        keyboardType="number-pad"
                      />
                    </>
                  )}

                  <Text style={styles.label}>{tStr('admin_plans_week_slots_title')}</Text>
                  <Text style={styles.hint}>{tStr('admin_plans_week_slots_hint')}</Text>
                  {formLocalSlots.map((slotRow) => (
                    <View key={slotRow.id || slotRow.tempKey} style={styles.slotCard}>
                      <View style={styles.slotRowHead}>
                        <Text style={{ color: t.subText, fontSize: 12, fontWeight: '700' }}>
                          {tStr('admin_plans_slot_row_day')}
                        </Text>
                        <TouchableOpacity style={styles.smallBtn} onPress={() => removeLocalSlot(slotRow)}>
                          <Ionicons name="trash-outline" size={20} color={t.danger} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.dowRow}>
                        {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                          const on = Number(slotRow.weekday) === d;
                          return (
                            <TouchableOpacity
                              key={d}
                              style={[styles.dowChip, on && styles.dowChipOn]}
                              onPress={() => patchLocalSlot(slotRow, { weekday: d })}
                            >
                              <Text style={[styles.dowChipTxt, on && styles.dowChipTxtOn]}>{dowLabel(tStr, d)}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={[styles.label, { marginTop: 4 }]}>{tStr('admin_plans_slot_row_slot')}</Text>
                      <TextInput
                        style={styles.input}
                        value={slotRow.slot_label}
                        onChangeText={(txt) => patchLocalSlot(slotRow, { slot_label: txt })}
                        placeholder="08:00"
                        placeholderTextColor={t.placeholder}
                      />
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addSlotBtn} onPress={addLocalSlot} activeOpacity={0.85}>
                    <Text style={styles.addSlotTxt}>{tStr('admin_plans_add_slot')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.hint}>{tStr('admin_plans_hint_program_slots')}</Text>
              )}

              <View style={styles.row}>
                <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={savePlan} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>{tStr('common_save')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { flex: 1, backgroundColor: t.overlayBorder }]}
                  onPress={cancelForm}
                >
                  <Text style={styles.btnText}>{tStr('common_cancel')}</Text>
                </TouchableOpacity>
              </View>
                </View>
              )}
            </View>
            <View style={isDesktopSplit ? styles.listCol : null}>
              {loading ? (
                <View style={styles.empty}>
                  <ActivityIndicator size="large" color={t.brand} />
                </View>
              ) : plans.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>{tStr('admin_plans_empty')}</Text>
                </View>
              ) : (
                <View style={styles.cardsGrid}>
                  {plans.map((p) => (
                    <View key={p.id} style={styles.card}>
                      <View style={styles.cardLeft}>
                        <Text style={styles.cardTitle}>{p.title}</Text>
                        <Text style={styles.cardMeta}>
                          {p.code} · {tStr('admin_plans_meta_order')} {p.order} · {tStr('admin_plans_meta_attendance')}:{' '}
                          {attendanceLabel(tStr, p.attendance_policy)}
                          {p.default_capacity != null
                            ? ` · ${tStr('admin_plans_meta_capacity').replace('{{n}}', String(p.default_capacity))}`
                            : ''}
                          {p.near_full_threshold != null
                            ? ` · ${tStr('admin_plans_meta_near_full').replace('{{n}}', String(p.near_full_threshold))}`
                            : ''}
                          {p.cancel_notice_hours != null
                            ? ` · ${tStr('admin_plans_meta_cancel_notice').replace('{{n}}', String(p.cancel_notice_hours))}`
                            : ''}
                          {' · '}
                          {p.active ? tStr('admin_plans_state_on') : tStr('admin_plans_state_off')}
                        </Text>
                      </View>
                      {isOwner && (
                        <>
                          <Switch value={!!p.active} onValueChange={() => toggleActive(p)} trackColor={{ false: t.overlayBorder, true: t.brand }} />
                          <TouchableOpacity onPress={() => openEdit(p)} style={{ padding: 8 }}>
                            <Ionicons name="pencil" size={22} color={t.brand} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
